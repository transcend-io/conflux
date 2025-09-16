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

interface ZipTransformerEntry {
  directory?: boolean;
  name: string;
  comment?: string;
  lastModified?: number;
  stream?: () => ReadableStream<Uint8Array>;
}

export type { ZipTransformerEntry };

interface ZipObject {
  directory: boolean;
  nameBuf: Uint8Array;
  offset: bigint;
  comment: Uint8Array;
  compressedLength: bigint;
  uncompressedLength: bigint;
  header: Uint8Array;
  crc?: Crc32;
}

class ZipTransformer {
  files: Record<string, ZipObject>;
  offset: bigint;

  constructor() {
    /* The files zipped */
    this.files = Object.create(null) as Record<string, ZipObject>;
    /* The current position of the zipped output stream, in bytes */
    this.offset = JSBI.BigInt(0);
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
    const data = new Uint8Array(30 + nameBuf.length);

    hdv.setUint32(0, 0x14_00_08_08);
    hdv.setUint16(
      6,
      (((date.getHours() << 6) | date.getMinutes()) << 5) |
        (date.getSeconds() / 2),
      true,
    );
    hdv.setUint16(
      8,
      ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) |
        date.getDate(),
      true,
    );
    hdv.setUint16(22, nameBuf.length, true);
    data.set([80, 75, 3, 4]);
    data.set(header, 4);
    data.set(nameBuf, 30);

    this.offset = JSBI.add(this.offset, JSBI.BigInt(data.length));
    ctrl.enqueue(data);

    const footer = new Uint8Array(16);
    footer.set([80, 75, 7, 8]);

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
      hdv.setUint32(14, JSBI.toNumber(zipObject.compressedLength), true);
      hdv.setUint32(18, JSBI.toNumber(zipObject.uncompressedLength), true);
      footer.set(header.subarray(10, 22), 4);
    }

    hdv.setUint16(22, nameBuf.length, true);

    this.offset = JSBI.add(
      this.offset,
      JSBI.add(zipObject.compressedLength, JSBI.BigInt(16)),
    );

    ctrl.enqueue(footer);
  }

  /**
   * @param  ctrl - The controller for the transform stream
   */
  flush(ctrl: TransformStreamDefaultController<Uint8Array>): void {
    let length = 0;
    let index = 0;
    let file: ZipObject | undefined;

    for (const fileName of Object.keys(this.files)) {
      file = this.files[fileName];
      if (!file) {
        throw new TypeError(
          `File not found while flushing ZipTransformer: ${fileName}`,
        );
      }
      length += 46 + file.nameBuf.length + file.comment.length;
    }

    const data = new Uint8Array(length + 22);
    const dv = new DataView(data.buffer);

    for (const fileName of Object.keys(this.files)) {
      file = this.files[fileName];
      if (!file) {
        throw new TypeError(
          `File not found while flushing ZipTransformer: ${fileName}`,
        );
      }
      dv.setUint32(index, 0x50_4b_01_02);
      dv.setUint16(index + 4, 0x14_00);
      dv.setUint16(index + 32, file.comment.length, true);
      dv.setUint8(index + 38, file.directory ? 16 : 0);
      dv.setUint32(index + 42, JSBI.toNumber(file.offset), true);
      data.set(file.header, index + 6);
      data.set(file.nameBuf, index + 46);
      data.set(file.comment, index + 46 + file.nameBuf.length);
      index += 46 + file.nameBuf.length + file.comment.length;
    }

    dv.setUint32(index, 0x50_4b_05_06);
    dv.setUint16(index + 8, Object.keys(this.files).length, true);
    dv.setUint16(index + 10, Object.keys(this.files).length, true);
    dv.setUint32(index + 12, length, true);
    dv.setUint32(index + 16, JSBI.toNumber(this.offset), true);
    ctrl.enqueue(data);

    // cleanup
    this.files = Object.create(null) as Record<string, ZipObject>;
    this.offset = JSBI.BigInt(0);
  }
}

export class Writer extends TransformStream<ZipTransformerEntry, Uint8Array> {
  /**
   * @param queueingStrategy - determines the number of entries being written before backpressure applied
   */
  constructor(queueingStrategy?: QueuingStrategy<ZipTransformerEntry>) {
    super(new ZipTransformer(), queueingStrategy);
  }
}
