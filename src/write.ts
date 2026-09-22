/**
 * Conflux
 * Build (and read) zip files with whatwg streams in the browser.
 *
 * @author Transcend Inc. <https://transcend.io>
 * @license MIT
 */
import { JSBI } from './bigint.js';
import { Crc32 } from './crc.js';

const encoder = new TextEncoder();

/** Largest value that fits in a classic 16-bit zip field; also the Zip64 sentinel. */
const MAX_UINT16 = 0xff_ff;
/** Largest value that fits in a classic 32-bit zip field; also the Zip64 sentinel. */
const MAX_UINT32 = 0xff_ff_ff_ff;
const MAX_UINT32_BIG = JSBI.BigInt(MAX_UINT32);
const SHIFT_32 = JSBI.BigInt(32);

/** "version made by" / "version needed to extract" 4.5 (Zip64 support), MS-DOS host. */
const ZIP_VERSION_45 = 0x2d;

const LOCAL_FILE_HEADER_LENGTH = 30;
/**
 * Zip64 extended information extra field carried by every local file header:
 * id (2) + data size (2) + uncompressed size (8) + compressed size (8).
 */
const LOCAL_ZIP64_EXTRA_FIELD_LENGTH = 20;
const DATA_DESCRIPTOR_LENGTH = 24;
const CENTRAL_DIRECTORY_RECORD_LENGTH = 46;
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LENGTH = 56;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_LENGTH = 20;

/**
 * Whether a value needs a 64-bit field. 0xFFFFFFFF itself is the sentinel
 * that points readers at the Zip64 extra field, so it also needs Zip64.
 */
const needsZip64 = (value: bigint): boolean =>
  JSBI.greaterThanOrEqual(value, MAX_UINT32_BIG);

/** Clamp a bigint into a classic 32-bit field, using the Zip64 sentinel on overflow. */
const clampUint32 = (value: bigint): number =>
  needsZip64(value) ? MAX_UINT32 : JSBI.toNumber(value);

/** Clamp a count into a classic 16-bit field, using the Zip64 sentinel on overflow. */
const clampUint16 = (value: number): number => Math.min(value, MAX_UINT16);

/**
 * Write an unsigned 64-bit little-endian integer as two 32-bit halves.
 * Avoids DataView#setBigUint64 so a JSBI polyfill can stand in for native BigInt.
 */
const setUint64 = (dv: DataView, position: number, value: bigint): void => {
  dv.setUint32(
    position,
    JSBI.toNumber(JSBI.bitwiseAnd(value, MAX_UINT32_BIG)),
    true,
  );
  dv.setUint32(
    position + 4,
    JSBI.toNumber(JSBI.signedRightShift(value, SHIFT_32)),
    true,
  );
};

export interface ZipTransformerEntry {
  directory?: boolean;
  name: string;
  comment?: string;
  lastModified?: number;
  stream?: () => ReadableStream<Uint8Array>;
}

/**
 * Everything the writer needs to re-emit a completed entry's central
 * directory record without having its bytes. Offsets and sizes are `bigint`,
 * matching the writer's internal counters; structured clone (e.g. IndexedDB)
 * preserves them. JSON needs a bigint↔string replacer/reviver.
 */
export interface ZipEntryCheckpoint {
  /** entry name as written, including a trailing `/` for directories */
  name: string;
  /** byte offset of the local file header */
  offset: bigint;
  /**
   * Bytes of entry data written after the local header. Named for the ZIP
   * "compressed size" field; this writer only uses STORE (method 0), so the
   * value always equals {@link uncompressedLength}.
   */
  compressedLength: bigint;
  /** Uncompressed size (always equal to compressedLength under STORE). */
  uncompressedLength: bigint;
  /** CRC-32 of the entry data, 0 for directories */
  crc32: number;
  /** MS-DOS time field as written in the local header */
  dosTime: number;
  /** MS-DOS date field as written in the local header */
  dosDate: number;
  directory: boolean;
  comment: string;
}

/** Archive position and completed entries to seed a resumed writer with. */
export interface ZipCheckpoint {
  /**
   * Byte offset the next local file header will be written at. Must equal the
   * end of the last completed entry's data descriptor.
   */
  offset: bigint;
  entries: ZipEntryCheckpoint[];
}

export interface ZipTransformerOptions {
  /**
   * Continue an archive whose leading bytes are already on disk. The writer
   * starts at `resumeFrom.offset`, treats `resumeFrom.entries` as written, and
   * emits them in the central directory when the stream closes.
   */
  resumeFrom?: ZipCheckpoint;
  /**
   * Fired after an entry's data descriptor has been enqueued, with the
   * checkpoint for that entry and the archive offset after it. Callers that
   * persist checkpoints should wait for the sink to accept those bytes before
   * treating the entry as durable.
   */
  onEntryComplete?: (entry: ZipEntryCheckpoint, archiveOffset: bigint) => void;
}

interface ZipObject {
  directory: boolean;
  nameBuf: Uint8Array;
  offset: bigint;
  comment: Uint8Array;
  compressedLength: bigint;
  uncompressedLength: bigint;
  /**
   * Bytes 4..30 of the local file header (version needed through extra
   * field length). Re-used as bytes 6..32 of the central directory record.
   */
  header: Uint8Array;
  crc?: Crc32;
}

const decoder = new TextDecoder();

/** flags: bit 3 (data descriptor) + bit 11 (UTF-8 names) */
const GENERAL_PURPOSE_FLAGS = 0x08_08;

/**
 * Write the fixed part of a local file header (bytes 4..30) into `header`.
 * Sizes and CRC are patched in later; only the fields known up front are set.
 */
const writeHeaderPrefix = (
  header: Uint8Array,
  dosTime: number,
  dosDate: number,
  nameLength: number,
  extraLength: number,
): void => {
  const hdv = new DataView(header.buffer, header.byteOffset, header.byteLength);
  hdv.setUint16(0, ZIP_VERSION_45, true);
  hdv.setUint16(2, GENERAL_PURPOSE_FLAGS, true);
  hdv.setUint16(6, dosTime, true);
  hdv.setUint16(8, dosDate, true);
  hdv.setUint16(22, nameLength, true);
  hdv.setUint16(24, extraLength, true);
};

/**
 * Rebuild a completed entry from its checkpoint so the central directory can
 * be emitted without the entry bytes.
 */
const zipObjectFromCheckpoint = (checkpoint: ZipEntryCheckpoint): ZipObject => {
  const nameBuf = encoder.encode(checkpoint.name);
  const header = new Uint8Array(26);
  writeHeaderPrefix(
    header,
    checkpoint.dosTime,
    checkpoint.dosDate,
    nameBuf.length,
    LOCAL_ZIP64_EXTRA_FIELD_LENGTH,
  );
  const hdv = new DataView(header.buffer);
  hdv.setUint32(10, checkpoint.crc32, true);
  hdv.setUint32(14, clampUint32(checkpoint.compressedLength), true);
  hdv.setUint32(18, clampUint32(checkpoint.uncompressedLength), true);
  return {
    directory: checkpoint.directory,
    nameBuf,
    offset: checkpoint.offset,
    comment: encoder.encode(checkpoint.comment),
    compressedLength: checkpoint.compressedLength,
    uncompressedLength: checkpoint.uncompressedLength,
    header,
  };
};

/** Serialize a completed entry for a checkpoint ledger. */
const checkpointFromZipObject = (
  name: string,
  zipObject: ZipObject,
): ZipEntryCheckpoint => {
  const hdv = new DataView(
    zipObject.header.buffer,
    zipObject.header.byteOffset,
    zipObject.header.byteLength,
  );
  return {
    name,
    offset: zipObject.offset,
    compressedLength: zipObject.compressedLength,
    uncompressedLength: zipObject.uncompressedLength,
    crc32: zipObject.crc?.get() ?? 0,
    dosTime: hdv.getUint16(6, true),
    dosDate: hdv.getUint16(8, true),
    directory: zipObject.directory,
    comment: decoder.decode(zipObject.comment),
  };
};

/**
 * Build the Zip64 extended information extra field for a local file header.
 *
 * The writer streams, so sizes are unknown when the local header is emitted
 * and the real values go in the data descriptor. Per APPNOTE 4.3.9.2 a reader
 * decides whether that descriptor carries 32- or 64-bit sizes by whether the
 * local header has a Zip64 extra field, so every entry carries one (with zero
 * placeholders) and every descriptor is 64-bit. This is the layout Info-ZIP
 * `zip` and Python `zipfile` produce for unseekable output.
 *
 * @returns the encoded extra field
 */
export function localZip64ExtraField(): Uint8Array {
  const extra = new Uint8Array(LOCAL_ZIP64_EXTRA_FIELD_LENGTH);
  const dv = new DataView(extra.buffer);
  dv.setUint16(0, 0x00_01, true);
  dv.setUint16(2, LOCAL_ZIP64_EXTRA_FIELD_LENGTH - 4, true);
  // uncompressed size (4..12) and compressed size (12..20) stay zero
  return extra;
}

/**
 * Build the 64-bit data descriptor that trails an entry's data.
 *
 * @param crc - CRC-32 of the entry data
 * @param compressedLength - compressed size of the entry
 * @param uncompressedLength - uncompressed size of the entry
 * @returns the encoded data descriptor
 */
export function dataDescriptor(
  crc: number,
  compressedLength: bigint,
  uncompressedLength: bigint,
): Uint8Array {
  const footer = new Uint8Array(DATA_DESCRIPTOR_LENGTH);
  const dv = new DataView(footer.buffer);
  dv.setUint32(0, 0x50_4b_07_08);
  dv.setUint32(4, crc, true);
  setUint64(dv, 8, compressedLength);
  setUint64(dv, 16, uncompressedLength);
  return footer;
}

/**
 * Build the Zip64 extended information extra field (id 0x0001) for a central
 * directory record. Per APPNOTE 4.5.3 it only carries the fields whose 32-bit
 * counterpart is set to 0xFFFFFFFF, in the fixed order: uncompressed size,
 * compressed size, local header offset.
 *
 * @param uncompressedLength - uncompressed size of the entry
 * @param compressedLength - compressed size of the entry
 * @param offset - offset of the local file header
 * @returns the encoded extra field, empty when no field overflows
 */
export function zip64ExtraField(
  uncompressedLength: bigint,
  compressedLength: bigint,
  offset: bigint,
): Uint8Array {
  const fields = [uncompressedLength, compressedLength, offset].filter(
    (value) => needsZip64(value),
  );
  if (fields.length === 0) {
    return new Uint8Array(0);
  }
  const extra = new Uint8Array(4 + fields.length * 8);
  const dv = new DataView(extra.buffer);
  dv.setUint16(0, 0x00_01, true);
  dv.setUint16(2, fields.length * 8, true);
  for (const [index, value] of fields.entries()) {
    setUint64(dv, 4 + index * 8, value);
  }
  return extra;
}

/**
 * Build the trailer of the archive: an optional Zip64 end of central directory
 * record + locator, followed by the classic end of central directory record.
 *
 * @param entryCount - number of entries in the central directory
 * @param centralDirectoryLength - byte length of the central directory
 * @param centralDirectoryOffset - offset of the start of the central directory
 * @param entriesNeedZip64 - whether any entry was written with Zip64 fields
 * @returns the encoded trailer
 */
export function endOfCentralDirectory(
  entryCount: number,
  centralDirectoryLength: bigint,
  centralDirectoryOffset: bigint,
  entriesNeedZip64: boolean,
): Uint8Array {
  const zip64 =
    entriesNeedZip64 ||
    entryCount >= MAX_UINT16 ||
    needsZip64(centralDirectoryLength) ||
    needsZip64(centralDirectoryOffset);

  const zip64Length = zip64
    ? ZIP64_END_OF_CENTRAL_DIRECTORY_LENGTH +
      ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_LENGTH
    : 0;
  const data = new Uint8Array(zip64Length + END_OF_CENTRAL_DIRECTORY_LENGTH);
  const dv = new DataView(data.buffer);
  const entryCountBig = JSBI.BigInt(entryCount);

  if (zip64) {
    // Zip64 end of central directory record (APPNOTE 4.3.14)
    dv.setUint32(0, 0x50_4b_06_06);
    setUint64(dv, 4, JSBI.BigInt(ZIP64_END_OF_CENTRAL_DIRECTORY_LENGTH - 12));
    dv.setUint16(12, ZIP_VERSION_45, true);
    dv.setUint16(14, ZIP_VERSION_45, true);
    // disk number (16) and disk with central directory (20) stay 0
    setUint64(dv, 24, entryCountBig);
    setUint64(dv, 32, entryCountBig);
    setUint64(dv, 40, centralDirectoryLength);
    setUint64(dv, 48, centralDirectoryOffset);

    // Zip64 end of central directory locator (APPNOTE 4.3.15)
    const locator = ZIP64_END_OF_CENTRAL_DIRECTORY_LENGTH;
    dv.setUint32(locator, 0x50_4b_06_07);
    // disk with the Zip64 end of central directory record (locator + 4) stays 0
    setUint64(
      dv,
      locator + 8,
      JSBI.add(centralDirectoryOffset, centralDirectoryLength),
    );
    dv.setUint32(locator + 16, 1, true);
  }

  // End of central directory record (APPNOTE 4.3.16)
  const eocd = zip64Length;
  dv.setUint32(eocd, 0x50_4b_05_06);
  dv.setUint16(eocd + 8, clampUint16(entryCount), true);
  dv.setUint16(eocd + 10, clampUint16(entryCount), true);
  dv.setUint32(eocd + 12, clampUint32(centralDirectoryLength), true);
  dv.setUint32(eocd + 16, clampUint32(centralDirectoryOffset), true);
  return data;
}

export class ZipTransformer {
  files: Record<string, ZipObject>;
  offset: bigint;
  private readonly onEntryComplete: ZipTransformerOptions['onEntryComplete'];

  constructor({ resumeFrom, onEntryComplete }: ZipTransformerOptions = {}) {
    /* The files zipped */
    this.files = Object.create(null) as Record<string, ZipObject>;
    /* The current position of the zipped output stream, in bytes */
    this.offset = JSBI.BigInt(0);
    this.onEntryComplete = onEntryComplete;

    if (resumeFrom) {
      for (const checkpoint of resumeFrom.entries) {
        if (this.files[checkpoint.name]) {
          throw new Error(
            `Duplicate entry in resume checkpoint: ${checkpoint.name}`,
          );
        }
        this.files[checkpoint.name] = zipObjectFromCheckpoint(checkpoint);
      }
      this.offset = resumeFrom.offset;
    }
  }

  /**
   * Transforms a stream of files into one zipped file
   *
   * @param  entry - The file to zip
   * @param  ctrl - The controller for the transform stream
   * @returns A promise that resolves when the file has been transformed
   */
  async transform(
    entry: ZipTransformerEntry,
    ctrl: TransformStreamDefaultController<Uint8Array>,
  ): Promise<void> {
    // Set the File name, ensuring that if it's a directory, it ends with `/`
    const name =
      entry.directory && !entry.name.trim().endsWith('/')
        ? `${entry.name.trim()}/`
        : entry.name.trim();

    // Abort if this a file with this name already exists
    if (this.files[name]) {
      ctrl.error(new Error('File already exists.'));
      return;
    }

    // TextEncode the name
    const nameBuf = encoder.encode(name);

    this.files[name] = {
      directory: !!entry.directory,
      nameBuf,
      offset: this.offset,
      comment: encoder.encode(entry.comment ?? ''),
      compressedLength: JSBI.BigInt(0),
      uncompressedLength: JSBI.BigInt(0),
      header: new Uint8Array(26),
    };

    const zipObject = this.files[name];
    const { header } = zipObject;

    // Set the date, with fallback to current date
    const date = new Date(entry.lastModified ?? Date.now());

    // The File header DataView
    const hdv = new DataView(header.buffer);
    const localExtra = localZip64ExtraField();
    const data = new Uint8Array(
      LOCAL_FILE_HEADER_LENGTH + nameBuf.length + localExtra.length,
    );

    // Local extra field length; flush() overwrites this slot of the shared
    // header with the central directory's own extra field length.
    writeHeaderPrefix(
      header,
      (((date.getHours() << 6) | date.getMinutes()) << 5) |
        (date.getSeconds() / 2),
      ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) |
        date.getDate(),
      nameBuf.length,
      localExtra.length,
    );
    data.set([80, 75, 3, 4]);
    data.set(header, 4);
    data.set(nameBuf, LOCAL_FILE_HEADER_LENGTH);
    data.set(localExtra, LOCAL_FILE_HEADER_LENGTH + nameBuf.length);

    this.offset = JSBI.add(this.offset, JSBI.BigInt(data.length));
    ctrl.enqueue(data);

    if (entry.stream) {
      zipObject.crc = new Crc32();
      const reader = entry.stream().getReader();

      while (true) {
        const it = await reader.read();
        if (it.done) break;
        const chunk = it.value;
        zipObject.crc.append(chunk);
        zipObject.uncompressedLength = JSBI.add(
          zipObject.uncompressedLength,
          JSBI.BigInt(chunk.length),
        );
        zipObject.compressedLength = JSBI.add(
          zipObject.compressedLength,
          JSBI.BigInt(chunk.length),
        );
        ctrl.enqueue(chunk);
      }

      hdv.setUint32(10, zipObject.crc.get(), true);
    }

    // Sizes that overflow 32 bits are stored in the Zip64 extra field of the
    // central directory record; the classic fields carry the sentinel.
    hdv.setUint32(14, clampUint32(zipObject.compressedLength), true);
    hdv.setUint32(18, clampUint32(zipObject.uncompressedLength), true);

    const footer = dataDescriptor(
      zipObject.crc?.get() ?? 0,
      zipObject.compressedLength,
      zipObject.uncompressedLength,
    );

    this.offset = JSBI.add(
      this.offset,
      JSBI.add(zipObject.compressedLength, JSBI.BigInt(footer.length)),
    );

    ctrl.enqueue(footer);

    this.onEntryComplete?.(
      checkpointFromZipObject(name, zipObject),
      this.offset,
    );
  }

  /**
   * @param  ctrl - The controller for the transform stream
   */
  flush(ctrl: TransformStreamDefaultController<Uint8Array>): void {
    const fileNames = Object.keys(this.files);
    const records: {
      file: ZipObject;
      extra: Uint8Array;
    }[] = [];
    let length = 0;
    let entriesNeedZip64 = false;

    for (const fileName of fileNames) {
      const file = this.files[fileName];
      if (!file) {
        throw new TypeError(
          `File not found while flushing ZipTransformer: ${fileName}`,
        );
      }
      const extra = zip64ExtraField(
        file.uncompressedLength,
        file.compressedLength,
        file.offset,
      );
      entriesNeedZip64 ||= extra.length > 0;
      records.push({ file, extra });
      length +=
        CENTRAL_DIRECTORY_RECORD_LENGTH +
        file.nameBuf.length +
        extra.length +
        file.comment.length;
    }

    const data = new Uint8Array(length);
    const dv = new DataView(data.buffer);
    let index = 0;

    for (const { file, extra } of records) {
      const hdv = new DataView(
        file.header.buffer,
        file.header.byteOffset,
        file.header.byteLength,
      );
      hdv.setUint16(24, extra.length, true);

      dv.setUint32(index, 0x50_4b_01_02);
      dv.setUint16(index + 4, ZIP_VERSION_45, true);
      data.set(file.header, index + 6);
      dv.setUint16(index + 32, file.comment.length, true);
      dv.setUint8(index + 38, file.directory ? 16 : 0);
      dv.setUint32(index + 42, clampUint32(file.offset), true);
      index += CENTRAL_DIRECTORY_RECORD_LENGTH;
      data.set(file.nameBuf, index);
      index += file.nameBuf.length;
      data.set(extra, index);
      index += extra.length;
      data.set(file.comment, index);
      index += file.comment.length;
    }

    ctrl.enqueue(data);
    ctrl.enqueue(
      endOfCentralDirectory(
        fileNames.length,
        JSBI.BigInt(length),
        this.offset,
        entriesNeedZip64,
      ),
    );

    // cleanup
    this.files = Object.create(null) as Record<string, ZipObject>;
    this.offset = JSBI.BigInt(0);
  }
}

export class Writer extends TransformStream<ZipTransformerEntry, Uint8Array> {
  /**
   * @param queueingStrategy - determines the number of entries being written before backpressure applied
   * @param options - resume seed and entry-complete callback, see {@link ZipTransformerOptions}
   */
  constructor(
    queueingStrategy?: QueuingStrategy<ZipTransformerEntry>,
    options: ZipTransformerOptions = {},
  ) {
    super(new ZipTransformer(options), queueingStrategy);
  }
}
