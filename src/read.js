/* eslint-disable no-underscore-dangle */
/**
 * Conflux
 * Read (and build) zip files with whatwg streams in the browser.
 *
 * @author Transcend Inc. <https://transcend.io>
 * @license MIT
 */
// eslint-disable-next-line import/extensions
import { TransformStream as PollyTransform } from 'web-streams-polyfill/ponyfill';
import { Inflate } from 'pako';
import Crc32 from './crc.js';

const TransformStream =
  globalThis.TransformStream ||
  globalThis.WebStreamsPolyfill?.TransformStream ||
  PollyTransform

class Inflator {
  async start(ctrl) {
    this.inflator = new Inflate({ raw: true });
    this.inflator.onData = (chunk) => ctrl.enqueue(chunk);
    this.done = new Promise((rs) => (this.inflator.onEnd = rs));
  }

  transform(chunk) {
    this.inflator.push(chunk);
  }

  flush() {
    return this.done;
  }
}

const ERR_BAD_FORMAT = 'File format is not recognized.';
const ZIP_COMMENT_MAX = 65536;
const EOCDR_MIN = 22;
const EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;
const MAX_VALUE_32BITS = 0xffffffff;

const decoder = new TextDecoder();
const uint16e = (b, n) => b[n] | (b[n + 1] << 8);

class Entry {
  constructor(dataView, fileLike) {
    if (dataView.getUint32(0) !== 0x504b0102) {
      throw new Error('ERR_BAD_FORMAT');
    }

    const dv = dataView;

    this.dataView = dv;
    this._fileLike = fileLike;
    this._extraFields = {};

    for (let i = 46 + this.filenameLength; i < dv.byteLength; ) {
      const id = dv.getUint16(i, true);
      const len = dv.getUint16(i + 2, true);
      const start = dv.byteOffset + i + 4;
      this._extraFields[id] = new DataView(dv.buffer.slice(start, start + len));
      i += len + 4;
    }
  }

  get versionMadeBy() {
    return this.dataView.getUint16(4, true);
  }

  get versionNeeded() {
    return this.dataView.getUint16(6, true);
  }

  get bitFlag() {
    return this.dataView.getUint16(8, true);
  }

  get encrypted() {
    return (this.bitFlag & 0x0001) === 0x0001;
  }

  get compressionMethod() {
    return this.dataView.getUint16(10, true);
  }

  get crc32() {
    return this.dataView.getUint32(16, true);
  }

  get compressedSize() {
    return this.dataView.getUint32(20, true);
  }

  get filenameLength() {
    return this.dataView.getUint16(28, true);
  }

  get extraFieldLength() {
    return this.dataView.getUint16(30, true);
  }

  get commentLength() {
    return this.dataView.getUint16(32, true);
  }

  get diskNumberStart() {
    return this.dataView.getUint16(34, true);
  }

  get internalFileAttributes() {
    return this.dataView.getUint16(36, true);
  }

  get externalFileAttributes() {
    return this.dataView.getUint32(38, true);
  }

  get directory() {
    return !!(this.dataView.getUint8(38) & 16);
  }

  get offset() {
    return this.dataView.getUint32(42, true);
  }

  get zip64() {
    return this.dataView.getUint32(24, true) === MAX_VALUE_32BITS;
  }

  get comment() {
    const dv = this.dataView;
    const uint8 = new Uint8Array(
      dv.buffer,
      dv.byteOffset + this.filenameLength + this.extraFieldLength + 46,
      this.commentLength,
    );
    return decoder.decode(uint8);
  }

  // File like IDL methods
  get lastModifiedDate() {
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

  get lastModified() {
    return +this.lastModifiedDate;
  }

  get name() {
    if (!this.bitFlag && this._extraFields && this._extraFields[0x7075]) {
      return decoder.decode(this._extraFields[0x7075].buffer.slice(5));
    }

    const dv = this.dataView;
    const uint8 = new Uint8Array(
      dv.buffer,
      dv.byteOffset + 46,
      this.filenameLength,
    );
    return decoder.decode(uint8);
  }

  get size() {
    const size = this.dataView.getUint32(24, true);
    return size === MAX_VALUE_32BITS ? this._extraFields[1].getUint8(0) : size;
  }

  stream() {
    const { readable, writable } = new TransformStream();
    // Need to read local header to get fileName + extraField length
    // Since they are not always the same length as in central dir...
    this._fileLike
      .slice(this.offset + 26, this.offset + 30)
      .arrayBuffer()
      .then((ab) => {
        const crc = new Crc32();
        const bytes = new Uint8Array(ab);
        const localFileOffset = uint16e(bytes, 0) + uint16e(bytes, 2) + 30;
        const start = this.offset + localFileOffset;
        const end = start + this.compressedSize;
        let stream = this._fileLike.slice(start, end).stream();

        if (this.compressionMethod) {
          stream = stream.pipeThrough(new TransformStream(new Inflator()));
        }

        stream = stream.pipeThrough(
          new TransformStream({
            transform(chunk, ctrl) {
              crc.append(chunk);
              ctrl.enqueue(chunk);
            },
            flush: (ctrl) => {
              if (crc.get() !== this.crc32) {
                ctrl.error(new Error("The crc32 checksum don't match"));
              }
            },
          }),
        );

        stream.pipeTo(writable);
      });

    return readable;
  }

  arrayBuffer() {
    return new Response(this.stream()).arrayBuffer().catch((e) => {
      throw new Error(`Failed to read Entry\n${e}`);
    });
  }

  text() {
    return new Response(this.stream()).text().catch((e) => {
      throw new Error(`Failed to read Entry\n${e}`);
    });
  }

  file() {
    return new Response(this.stream())
      .blob()
      .then(
        (blob) =>
          new File([blob], this.name, { lastModified: this.lastModified }),
      )
      .catch((e) => {
        throw new Error(`Failed to read Entry\n${e}`);
      });
  }
}

async function* Reader(file) {
  // Seek EOCDR - "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
  // Zip file comment is the last part of EOCDR and has max length of 64KB,
  // so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
  if (file.size < EOCDR_MIN) throw new Error(ERR_BAD_FORMAT);

  // seek last length bytes of file for EOCDR
  async function doSeek(length) {
    const ab = await file.slice(file.size - length).arrayBuffer();
    const bytes = new Uint8Array(ab);
    for (let i = bytes.length - EOCDR_MIN; i >= 0; i--) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x05 &&
        bytes[i + 3] === 0x06
      ) {
        return new DataView(bytes.buffer, i, EOCDR_MIN);
      }
    }

    return null;
  }

  // In most cases, the EOCDR is EOCDR_MIN bytes long
  let dv =
    (await doSeek(EOCDR_MIN)) || (await doSeek(Math.min(EOCDR_MAX, file.size)));

  if (!dv) throw new Error(ERR_BAD_FORMAT);

  let fileslength = dv.getUint16(8, true);
  let centralDirSize = dv.getUint32(12, true);
  let centralDirOffset = dv.getUint32(16, true);
  // const fileCommentLength = dv.getUint16(20, true);

  const isZip64 = centralDirOffset === MAX_VALUE_32BITS;

  if (isZip64) {
    const l = -dv.byteLength - 20;
    dv = new DataView(await file.slice(l, -dv.byteLength).arrayBuffer());

    // const signature = dv.getUint32(0, true) // 4 bytes
    // const diskWithZip64CentralDirStart = dv.getUint32(4, true) // 4 bytes
    const relativeOffsetEndOfZip64CentralDir = Number(dv.getBigInt64(8, true)); // 8 bytes
    // const numberOfDisks = dv.getUint32(16, true) // 4 bytes

    const zip64centralBlob = file.slice(relativeOffsetEndOfZip64CentralDir, l);
    dv = new DataView(await zip64centralBlob.arrayBuffer());
    // const zip64EndOfCentralSize = dv.getBigInt64(4, true)
    // const diskNumber = dv.getUint32(16, true)
    // const diskWithCentralDirStart = dv.getUint32(20, true)
    // const centralDirRecordsOnThisDisk = dv.getBigInt64(24, true)
    fileslength = Number(dv.getBigInt64(32, true));
    centralDirSize = Number(dv.getBigInt64(40, true));
    centralDirOffset = Number(dv.getBigInt64(48, true));
  }

  if (centralDirOffset < 0 || centralDirOffset >= file.size) {
    throw new Error(ERR_BAD_FORMAT);
  }

  const start = centralDirOffset;
  const end = centralDirOffset + centralDirSize;
  const blob = file.slice(start, end);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  for (let i = 0, index = 0; i < fileslength; i++) {
    const size =
      uint16e(bytes, index + 28) + // filenameLength
      uint16e(bytes, index + 30) + // extraFieldLength
      uint16e(bytes, index + 32) + // commentLength
      46;

    if (index + size > bytes.length) {
      throw new Error('Invalid ZIP file.');
    }

    yield new Entry(new DataView(bytes.buffer, index, size), file);

    index += size;
  }
}

export default Reader;
