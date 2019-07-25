class Inflator {
  async start(ctrl) {
    if (!globalThis.pako) {
      await import('https://cdn.jsdelivr.net/npm/pako@1.0.10/dist/pako.min.js')
    }
    this.inflator = new pako.Inflate({ raw: true })
    this.inflator.onData = chunk => ctrl.enqueue(chunk)
    this.done = new Promise(rs => (this.inflator.onEnd = rs))
  }
  transform(chunk) { this.inflator.push(chunk) }
  flush() { return this.done }
}

// TODO: later
const ERR_BAD_FORMAT = 'File format is not recognized.';
const ZIP_COMMENT_MAX = 65536;
const EOCDR_MIN = 22;
const EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;
const MAX_VALUE_32BITS = 0xFFFFFFFF;

const decoder = new TextDecoder();

class Entry {
  constructor(dataView, fileLike) {
    if (dataView.getUint32(0) !== 0x504b0102) {
      throw new Error('ERR_BAD_FORMAT');
    }

    const dv = dataView;

    this.dataView = dv;
    this._fileLike = fileLike;
    this.extraFields = {};

    for (let i = 46 + this.filenameLength; i < dv.byteLength;) {
      let id = dv.getUint16(i, true);
      let len = dv.getUint16(i + 2, true);
      this.extraFields[id] = new DataView(dv.buffer, dv.byteOffset + i + 4, len);
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
    return !!(this.dataView.getUint8(8) & 1)
  }
  get compressionMethod() {
    return this.dataView.getUint16(10, true);
  }
  get lastModDateRaw() {
    return this.dataView.getUint32(12, true);
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
    return this.dataView.getUint8(38) === 16;
  }
  get offset() {
    return this.dataView.getUint16(42, true);
  }
  get zip64() {
    return this.size === 0xFFFFFFFF ||
           this.uncompressedSize === 0xFFFFFFFF;
  }
  get comment() {
    const dv = this.dataView;
    const uint8 = new Uint8Array(
      dv.buffer,
      dv.byteOffset + this.filenameLength + this.extraFieldLength + 46,
      this.commentLength
    );
    return decoder.decode(uint8);
  }

  // File like IDL methods

  get lastModifiedDate() {
    // TODO: conversion
    return new Date(this.lastModDate);
  }

  get lastModified() {

  }

  get name() {
    const dv = this.dataView;
    const uint8 = new Uint8Array(dv.buffer, dv.byteOffset + 46, this.filenameLength);
    return decoder.decode(uint8);
  }

  get size() {
    const size = this.dataView.getUint32(24, true);
    return size === MAX_VALUE_32BITS ? this.extraFields[1].getUint8(0) : size;
  }

  stream() {
    const start = this.offset + this.filenameLength + 30;
    const end = start + this.compressedSize;

    let stream = this
      ._fileLike
      .slice(start, end)
      .stream();

    if (this.compressionMethod) {
      stream = stream.pipeThrough(
        new TransformStream(new Inflator())
      )
    }

    return stream
      // .pipeThrough(crc) // TODO: crc32 validate
  }

  arrayBuffer() {
    return new Response(this.stream()).arrayBuffer();
  }

  text() {
    return new Response(this.stream()).text();
  }
}

async function * seekEOCDR(file) {
  const uint16e = (b, n) => b[n] | (b[n + 1] << 8);

  // "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
  // Zip file comment is the last part of EOCDR and has max length of 64KB,
  // so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
  if (file.size < EOCDR_MIN) throw new Error(ERR_BAD_FORMAT);

  // In most cases, the EOCDR is EOCDR_MIN bytes long
  let dv = await doSeek(EOCDR_MIN) ||
             await doSeek(Math.min(EOCDR_MAX, file.size));

  if (!dv) throw new Error(ERR_BAD_FORMAT);

  let fileslength = dv.getUint16(8, true);
  let centralDirSize = dv.getUint32(12, true);
  let centralDirOffset = dv.getUint32(16, true);
  const isZip64 = centralDirOffset === MAX_VALUE_32BITS;

  const l = -dv.byteLength - 20
  dv = new DataView(await file.slice(l, -dv.byteLength).arrayBuffer())

  if (isZip64) {
    // const signature = dv.getUint32(0, true) // 4 bytes
    // const diskWithZip64CentralDirStart = dv.getUint32(4, true) // 4 bytes
    const relativeOffsetEndOfZip64CentralDir = Number(dv.getBigInt64(8, true)) // 8 bytes
    // const numberOfDisks = dv.getUint32(16, true) // 4 bytes

    const zip64centralBlob = file.slice(relativeOffsetEndOfZip64CentralDir, l)
    dv = new DataView(await zip64centralBlob.arrayBuffer())
    // const zip64EndOfCentralSize = dv.getBigInt64(4, true)
    // const diskNumber = dv.getUint32(16, true)
    // const diskWithCentralDirStart = dv.getUint32(20, true)
    // const centralDirRecordsOnThisDisk = dv.getBigInt64(24, true)
    fileslength = dv.getBigInt64(32, true)
    centralDirSize = dv.getBigInt64(40, true)
    centralDirOffset = dv.getBigInt64(48, true)
  }

  if (centralDirOffset < 0 || (centralDirOffset >= file.size)) {
    throw new Error(ERR_BAD_FORMAT);
  }

  const blob = file.slice(Number(centralDirOffset), Number(centralDirOffset + centralDirSize));
  const bytes = new Uint8Array(await blob.arrayBuffer());

  for (let i = 0, index = 0; i < fileslength; i++) {
    const size =
      uint16e(bytes, index + 28) + // filenameLength
      uint16e(bytes, index + 30) + // extraFieldLength
      uint16e(bytes, index + 32) + // commentLength
      46;

    yield new Entry(
      new DataView(bytes.buffer, index, size),
      file
    );

    index += size;
  }

  // seek last length bytes of file for EOCDR
  async function doSeek(length) {
    const ab = await file.slice(file.size - length).arrayBuffer();
    const bytes = new Uint8Array(ab);
    for (let i = bytes.length - EOCDR_MIN; i >= 0; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        return new DataView(bytes.buffer, i, EOCDR_MIN);
      }
    }

    return null;
  }
}

export default seekEOCDR;
