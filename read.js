// TODO: later
const ERR_BAD_FORMAT = 'File format is not recognized.'
const ZIP_COMMENT_MAX = 65536
const EOCDR_MIN = 22
const EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX

const decoder = new TextDecoder()

function getDataHelper (byteLength, bytes) {
  var dataBuffer = new ArrayBuffer(byteLength)
  var dataArray = new Uint8Array(dataBuffer)
  if (bytes) dataArray.set(bytes, 0)

  return {
    buffer: dataBuffer,
    array: dataArray,
    view: new DataView(dataBuffer)
  }
}

class Entry {
  constructor (dataView) {
    if (dataView.getUint32(0) !== 0x504b0102) {
      throw new Error('ERR_BAD_FORMAT')
    }
    this.dataView = dataView
  }
  get version () {
    return this.dataView.getUint16(6, true)
  }
  get bitFlag () {
    return this.dataView.getUint16(8, true)
  }
  get encrypted () {
    return (this.bitFlag & 1) === 1
  }
  get compressionMethod () {
    return this.dataView.getUint16(10, true)
  }
  get lastModDateRaw () {
    return this.dataView.getUint32(12, true)
  }
  get crc32 () {
    return this.dataView.getUint32(16, true)
  }
  get compressedSize () {
    return this.dataView.getUint32(20, true)
  }
  get uncompressedSize () {
    return this.dataView.getUint32(24, true)
  }
  get filenameLength () {
    return this.dataView.getUint16(28, true)
  }
  get extraFieldLength () {
    return this.dataView.getUint16(30, true)
  }
  get commentLength () {
    return this.dataView.getUint16(32, true)
  }
  get directory () {
    return (this.dataView.getUint8(38) & 16) === 16 &&
            entry.filename.endsWith('/')
  }
  get offset () {
    return this.dataView.getUint16(42, true)
  }
  get zip64 () {
    return this.compressedSize === 0xFFFFFFFF ||
           this.uncompressedSize === 0xFFFFFFFF
  }
  get lastModDate () {
    // TODO conversion
    return new Date(this.lastModDate)
  }

  get comment () {
    const dv = this.dataView
    const uint8 = new Uint8Array(dv.buffer, dv.byteOffset + 46 + this.filenameLength + this.extraFieldLength, this.commentLength)
    return decoder.decode(uint8)
  }

  // Blob like IDL methods

  get name () {
    const dv = this.dataView
    const uint8 = new Uint8Array(dv.buffer, dv.byteOffset + 46, this.filenameLength)
    return decoder.decode(uint8)
  }

  get size () {
    return this.uncompressedSize
  }

  stream () { }

  arrayBuffer () {
    return new Response(this.stream()).arrayBuffer()
  }

  text () {
    return new Response(this.stream()).text()
  }
}


async function seekEOCDR (fileLike) {
  // "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
  // Zip file comment is the last part of EOCDR and has max length of 64KB,
  // so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
  if (fileLike.size < EOCDR_MIN) throw new Error(ERR_BAD_FORMAT)

  // In most cases, the EOCDR is EOCDR_MIN bytes long
  const dv = await doSeek(EOCDR_MIN) ||
             await doSeek(Math.min(EOCDR_MAX, fileLike.size))

  if (!dv) throw new Error(ERR_BAD_FORMAT)

  const datalength = dv.getUint32(16, true)
  const fileslength = dv.getUint16(8, true)

  if (datalength < 0 || datalength >= fileLike.size) {
    throw new Error(ERR_BAD_FORMAT)
  }

  // const bytes = await fileLike.slice(fileLike.size - datalength).arrayBuffer()
  const bytes = new Uint8Array(await fileLike.slice(datalength).arrayBuffer())

  var i,
      index = 0,
      entries = [],
      entry,
      filename,
      comment,
      data = getDataHelper(bytes.byteLength, bytes);

  var decoder = new TextDecoder()

  for (i = 0; i < fileslength; i++) {
    const size = data.view.getUint16(index + 28, true) + // filenameLength
                 data.view.getUint16(index + 30, true) + // extraFieldLength
                 data.view.getUint16(index + 32, true)   // commentLength

    entry = new Entry(new DataView(data.view.buffer, index, 46 + size))
    entries.push(entry)

    index += 46 + size
  }

  // seek last length bytes of file for EOCDR
  async function doSeek (length) {
    const ab = await fileLike.slice(fileLike.size - length).arrayBuffer()
    const bytes = new Uint8Array(ab)
    for (var i = bytes.length - EOCDR_MIN; i >= 0; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        return new DataView(bytes.buffer, i, EOCDR_MIN)
      }
    }

    return null
  }

  return entries
}

export default seekEOCDR
