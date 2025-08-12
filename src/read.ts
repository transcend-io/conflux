/**
 * Conflux
 * Read (and build) zip files with whatwg streams in the browser.
 *
 * @author Transcend Inc. <https://transcend.io>
 * @license MIT
 */
import { Inflate } from 'pako';
import { JSBI } from './bigint.js';
import { Crc32 } from './crc.js';

const ERR_BAD_FORMAT = 'File format is not recognized.';
const ZIP_COMMENT_MAX = 65_536;
const EOCDR_MIN = 22;
const EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;
const MAX_VALUE_32BITS = 0xff_ff_ff_ff;

const decoder = new TextDecoder();
const uint16LittleEndian = (b: Uint8Array, n: number): number => {
  const b1 = b[n];
  const b2 = b[n + 1];
  if (b1 === undefined || b2 === undefined) {
    return 0;
  }
  return b1 | (b2 << 8);
};

type FileLike = Pick<File, 'slice' | 'stream' | 'arrayBuffer' | 'size'>;

class Entry {
  dataView: DataView;
  private _fileLike: FileLike;
  private _extraFields: Record<number, DataView> = {};

  constructor(dataView: DataView, fileLike: FileLike) {
    if (dataView.getUint32(0) !== 0x50_4b_01_02) {
      throw new Error('ERR_BAD_FORMAT');
    }

    const dv = dataView;

    this.dataView = dv;
    this._fileLike = fileLike;

    for (let index = 46 + this.filenameLength; index < dv.byteLength; ) {
      const id = dv.getUint16(index, true);
      const length = dv.getUint16(index + 2, true);
      const start = dv.byteOffset + index + 4;
      this._extraFields[id] = new DataView(
        dv.buffer.slice(start, start + length),
      );
      index += length + 4;
    }
  }

  get versionMadeBy(): number {
    return this.dataView.getUint16(4, true);
  }

  get versionNeeded(): number {
    return this.dataView.getUint16(6, true);
  }

  get bitFlag(): number {
    return this.dataView.getUint16(8, true);
  }

  get encrypted(): boolean {
    return (this.bitFlag & 0x00_01) === 0x00_01;
  }

  get compressionMethod(): number {
    return this.dataView.getUint16(10, true);
  }

  get crc32(): number {
    return this.dataView.getUint32(16, true);
  }

  get compressedSize(): number {
    return this.dataView.getUint32(20, true);
  }

  get filenameLength(): number {
    return this.dataView.getUint16(28, true);
  }

  get extraFieldLength(): number {
    return this.dataView.getUint16(30, true);
  }

  get commentLength(): number {
    return this.dataView.getUint16(32, true);
  }

  get diskNumberStart(): number {
    return this.dataView.getUint16(34, true);
  }

  get internalFileAttributes(): number {
    return this.dataView.getUint16(36, true);
  }

  get externalFileAttributes(): number {
    return this.dataView.getUint32(38, true);
  }

  get directory(): boolean {
    return !!(this.dataView.getUint8(38) & 16);
  }

  get offset(): number {
    return this.dataView.getUint32(42, true);
  }

  get zip64(): boolean {
    return this.dataView.getUint32(24, true) === MAX_VALUE_32BITS;
  }

  get comment(): string {
    const dv = this.dataView;
    const uint8 = new Uint8Array(
      dv.buffer,
      dv.byteOffset + this.filenameLength + this.extraFieldLength + 46,
      this.commentLength,
    );
    return decoder.decode(uint8);
  }

  // File like IDL methods
  get lastModifiedDate(): Date {
    const t = this.dataView.getUint32(12, true);

    return new Date(
      // Date.UTC(
      ((t >> 25) & 0x7f) + 1980, // year
      ((t >> 21) & 0x0f) - 1, // month
      (t >> 16) & 0x1f, // day
      (t >> 11) & 0x1f, // hour
      (t >> 5) & 0x3f, // minute
      (t & 0x1f) << 1,
      // ),
    );
  }

  get lastModified(): number {
    return +this.lastModifiedDate;
  }

  get name(): string {
    if (!this.bitFlag && this._extraFields[0x70_75]) {
      return decoder.decode(this._extraFields[0x70_75].buffer.slice(5));
    }

    const dv = this.dataView;
    const uint8 = new Uint8Array(
      dv.buffer,
      dv.byteOffset + 46,
      this.filenameLength,
    );
    return decoder.decode(uint8);
  }

  get size(): number | bigint {
    const size = this.dataView.getUint32(24, true);
    if (size === MAX_VALUE_32BITS) {
      const field = this._extraFields[1];
      if (!field) {
        return 0;
      }
      return field.getBigUint64(0, true);
    }
    return size;
  }

  stream(): ReadableStream<Uint8Array> {
    // eslint-disable-next-line unicorn/no-this-assignment, @typescript-eslint/no-this-alias
    const self = this;
    const crc = new Crc32();
    let inflator: Inflate | undefined;
    const onEnd = (ctrl: ReadableStreamDefaultController<Uint8Array>): void => {
      if (crc.get() === self.crc32) {
        ctrl.close();
      } else {
        ctrl.error(new Error('The crc32 checksum did not match'));
      }
    };

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    return new ReadableStream({
      async start(ctrl: ReadableStreamDefaultController<Uint8Array>) {
        // Need to read local header to get fileName + extraField length
        // Since they are not always the same length as in central dir...
        const ab = await self._fileLike
          .slice(self.offset + 26, self.offset + 30)
          .arrayBuffer();

        const bytes = new Uint8Array(ab);
        const localFileOffset =
          uint16LittleEndian(bytes, 0) + uint16LittleEndian(bytes, 2) + 30;
        const start = self.offset + localFileOffset;
        const end = start + self.compressedSize;
        reader = self._fileLike.slice(start, end).stream().getReader();

        if (self.compressionMethod) {
          inflator = new Inflate({ raw: true });
          inflator.onData = (chunk: Uint8Array): void => {
            crc.append(chunk);
            ctrl.enqueue(chunk);
          };
          inflator.onEnd = (): void => {
            onEnd(ctrl);
          };
        }
      },
      async pull(ctrl: ReadableStreamDefaultController<Uint8Array>) {
        if (!reader) {
          throw new Error('Reader is not initialized');
        }
        const v = await reader.read();
        if (inflator && !v.done) {
          inflator.push(v.value, false);
        } else if (v.done) {
          if (inflator) {
            inflator.push(new Uint8Array(0), true);
          }
          onEnd(ctrl);
        } else {
          ctrl.enqueue(v.value);
          crc.append(v.value);
        }
      },
    });
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return new Response(this.stream()).arrayBuffer().catch((error: unknown) => {
      throw new Error(`Failed to read Entry\n${error as string}`);
    });
  }

  text(): Promise<string> {
    return new Response(this.stream()).text().catch((error: unknown) => {
      throw new Error(`Failed to read Entry\n${error as string}`);
    });
  }

  file(): Promise<File> {
    return new Response(this.stream())
      .blob()
      .then(
        (blob) =>
          new File([blob], this.name, { lastModified: this.lastModified }),
      )
      .catch((error: unknown) => {
        throw new Error(`Failed to read Entry\n${error as string}`);
      });
  }
}

export type { Entry };

/**
 * Get a BigInt 64 from a DataView
 *
 * @param view a dataview
 * @param position the position
 * @param littleEndian whether this uses littleEndian encoding
 * @returns BigInt
 */
function getBigInt64(
  view: DataView,
  position: number,
  littleEndian = false,
): bigint {
  if ('getBigInt64' in DataView.prototype) {
    return view.getBigInt64(position, littleEndian);
  }

  let value = JSBI.BigInt(0);
  const isNegative =
    (view.getUint8(position + (littleEndian ? 7 : 0)) & 0x80) > 0;
  let carrying = true;

  for (let index = 0; index < 8; index++) {
    let byte = view.getUint8(position + (littleEndian ? index : 7 - index));

    if (isNegative) {
      if (carrying) {
        if (byte !== 0x00) {
          byte = ~(byte - 1) & 0xff;
          carrying = false;
        }
      } else {
        byte = ~byte & 0xff;
      }
    }

    value = JSBI.add(
      value,
      JSBI.multiply(
        JSBI.BigInt(byte),
        JSBI.exponentiate(JSBI.BigInt(256), JSBI.BigInt(index)),
      ),
    );
  }

  if (isNegative) {
    value = JSBI.unaryMinus(value);
  }

  return value;
}

export async function* Reader(
  file: FileLike,
): AsyncGenerator<Entry, void, unknown> {
  // Seek EOCDR - "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
  // Zip file comment is the last part of EOCDR and has max length of 64KB,
  // so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
  if (file.size < EOCDR_MIN) throw new Error(ERR_BAD_FORMAT);

  // seek last length bytes of file for EOCDR
  async function doSeek(length: number): Promise<DataView | null> {
    const ab = await file.slice(file.size - length, file.size).arrayBuffer();
    const bytes = new Uint8Array(ab);
    for (let index = bytes.length - EOCDR_MIN; index >= 0; index--) {
      if (
        bytes[index] === 0x50 &&
        bytes[index + 1] === 0x4b &&
        bytes[index + 2] === 0x05 &&
        bytes[index + 3] === 0x06
      ) {
        return new DataView(bytes.buffer, index, EOCDR_MIN);
      }
    }

    return null;
  }

  // In most cases, the EOCDR is EOCDR_MIN bytes long
  let dv =
    (await doSeek(EOCDR_MIN)) ?? (await doSeek(Math.min(EOCDR_MAX, file.size)));

  if (!dv) throw new Error(ERR_BAD_FORMAT);

  let filesCount = dv.getUint16(8, true);
  let centralDirectorySize = dv.getUint32(12, true);
  let centralDirectoryOffset = dv.getUint32(16, true);
  // const fileCommentLength = dv.getUint16(20, true);

  const isZip64 = centralDirectoryOffset === MAX_VALUE_32BITS;

  if (isZip64) {
    const l = -dv.byteLength - 20;
    dv = new DataView(await file.slice(l, -dv.byteLength).arrayBuffer());

    // const signature = dv.getUint32(0, true) // 4 bytes
    // const diskWithZip64CentralDirStart = dv.getUint32(4, true) // 4 bytes
    const relativeOffsetEndOfZip64CentralDirectory = JSBI.toNumber(
      getBigInt64(dv, 8, true),
    ); // 8 bytes
    // const numberOfDisks = dv.getUint32(16, true) // 4 bytes

    const zip64centralBlob = file.slice(
      relativeOffsetEndOfZip64CentralDirectory,
      l,
    );
    dv = new DataView(await zip64centralBlob.arrayBuffer());
    // const zip64EndOfCentralSize = dv.getBigInt64(4, true)
    // const diskNumber = dv.getUint32(16, true)
    // const diskWithCentralDirStart = dv.getUint32(20, true)
    // const centralDirRecordsOnThisDisk = dv.getBigInt64(24, true)
    filesCount = JSBI.toNumber(getBigInt64(dv, 32, true));
    centralDirectorySize = JSBI.toNumber(getBigInt64(dv, 40, true));
    centralDirectoryOffset = JSBI.toNumber(getBigInt64(dv, 48, true));
  }

  if (centralDirectoryOffset < 0 || centralDirectoryOffset >= file.size) {
    throw new Error(ERR_BAD_FORMAT);
  }

  const start = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;
  const blob = file.slice(start, end);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  for (
    let fileNumber = 0, totalSize = 0;
    fileNumber < filesCount;
    fileNumber++
  ) {
    const size =
      uint16LittleEndian(bytes, totalSize + 28) + // filenameLength
      uint16LittleEndian(bytes, totalSize + 30) + // extraFieldLength
      uint16LittleEndian(bytes, totalSize + 32) + // commentLength
      46;

    if (totalSize + size > bytes.length) {
      throw new Error('Invalid ZIP file.');
    }

    yield new Entry(new DataView(bytes.buffer, totalSize, size), file);

    totalSize += size;
  }
}
