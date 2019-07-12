// TODO: later
const ERR_BAD_FORMAT = 'File format is not recognized.';
const ZIP_COMMENT_MAX = 65536;
const EOCDR_MIN = 22;
const EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;

const decoder = new TextDecoder();

class Entry {
  constructor(dataView, fileLike) {
    if (dataView.getUint32(0) !== 0x504b0102) {
      throw new Error('ERR_BAD_FORMAT');
    }
    this.dataView = dataView;
    this._fileLike = fileLike;
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
    return (this.bitFlag & 1) === 1;
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
    return this.dataView.getUint16(38, true);
  }
  get directory() {
    return (this.externalFileAttributes & 16) === 16;
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
    const uint8 = new Uint8Array(dv.buffer, dv.byteOffset + 46 + this.filenameLength + this.extraFieldLength, this.commentLength);
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
    return this.dataView.getUint32(24, true);
  }

  stream() {
    // TODO: Investigate
    // From my understanding jszip tells me that extraFieldLength **might**
    // vary from local and central dir?
    // - wtf?!
    // one guess is that if extraFieldLength is defined it will then also
    // have a 4 byte added signature? reason:
    //
    // 4.3.11  Archive extra data record:
    //
    //      archive extra data signature    4 bytes  (0x08064b50)
    //      extra field length              4 bytes
    //      extra field data                (variable size)
    //
    // But i can also be wrong. An example file i tried to read was
    // https://cdn.jsdelivr.net/gh/Stuk/jszip/test/ref/extra_attributes.zip
    // in the central dir the length was 24
    // in local header it was 28
    const extra = this.extraFieldLength;

    const start = this.offset + this.filenameLength + 30 + (extra ? extra + 4 : 0);
    const end = start + this.compressedSize;

    return this
      ._fileLike
      .slice(start, end)
      .stream();
      // .pipeThrought(inflate) // TODO: optional inflate
      // .pipeThrought(crc) // TODO: crc32 validate
  }

  arrayBuffer() {
    return new Response(this.stream()).arrayBuffer();
  }

  text() {
    return new Response(this.stream()).text();
  }
}

async function * seekEOCDR(fileLike) {
  // "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
  // Zip file comment is the last part of EOCDR and has max length of 64KB,
  // so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
  if (fileLike.size < EOCDR_MIN) throw new Error(ERR_BAD_FORMAT);

  // In most cases, the EOCDR is EOCDR_MIN bytes long
  const dv = await doSeek(EOCDR_MIN) ||
             await doSeek(Math.min(EOCDR_MAX, fileLike.size));

  if (!dv) throw new Error(ERR_BAD_FORMAT);

  const datalength = dv.getUint32(16, true);
  const fileslength = dv.getUint16(8, true);
  const isZip64 = datalength === 0xFFFFFFFF;

  if (datalength < 0 || (!isZip64 && datalength >= fileLike.size)) {
    throw new Error(ERR_BAD_FORMAT);
  }

  // const bytes = await fileLike.slice(fileLike.size - datalength).arrayBuffer()
  const bytes = new Uint8Array(await fileLike.slice(datalength).arrayBuffer());

  const uint16e = (b, n) => b[n] | (b[n + 1] << 8);

  for (let i = 0, index = 0; i < fileslength; i++) {
    const size =
      uint16e(bytes, 28) + // filenameLength
      uint16e(bytes, 30) + // extraFieldLength
      uint16e(bytes, 32) + // commentLength
      46;

    yield new Entry(
      new DataView(bytes.buffer, index, size),
      fileLike
    );

    index += size;
  }

  // seek last length bytes of file for EOCDR
  async function doSeek(length) {
    const ab = await fileLike.slice(fileLike.size - length).arrayBuffer();
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
