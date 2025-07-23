/* global globalThis */
/* eslint-disable no-underscore-dangle,no-use-before-define,no-param-reassign  */
/**
 * Conflux
 * Read (and build) zip files with whatwg streams in the browser.
 *
 * @author Transcend Inc. <https://transcend.io>
 * @license MIT
 */
// eslint-disable-next-line import/extensions
import { Inflate } from 'pako';
// eslint-disable-next-line import/extensions
import { TransformStream as PonyfillTransformStream } from 'web-streams-polyfill/ponyfill';
import JSBI from './bigint.js';
import Crc32 from './crc.js';

const ERR_BAD_FORMAT = 'File format is not recognized.';
const ZIP_COMMENT_MAX = 65536;
const EOCDR_MIN = 22;
const EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;
const MAX_VALUE_32BITS = 0xffffffff; // ZIP64 indicator: when 32-bit fields reach this value, use ZIP64 extra field

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
    const size = this.dataView.getUint32(20, true);
    if (size === MAX_VALUE_32BITS) {
      // For ZIP64, read the actual compressed size from the ZIP64 extra field
      const extraField = this._extraFields[0x0001];
      if (extraField) {
        const rawUncompressedSize = this.dataView.getUint32(24, true);
        let zip64Offset = 0;

        // If uncompressed size is 0xFFFFFFFF, skip 8 bytes
        if (rawUncompressedSize === MAX_VALUE_32BITS) {
          zip64Offset += 8;
        }

        return JSBI.toNumber(getBigInt64(extraField, zip64Offset, true));
      }
    }
    return size;
  }

  get uncompressedSize() {
    const size = this.dataView.getUint32(24, true);
    if (size === MAX_VALUE_32BITS) {
      // For ZIP64, read the actual uncompressed size from the ZIP64 extra field
      const extraField = this._extraFields[0x0001];
      if (extraField) {
        // According to ZIP64 specification (4.5.3), Original Size is always at offset 0
        return JSBI.toNumber(getBigInt64(extraField, 0, true));
      }
    }
    return size;
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
    if (this.zip64) {
      // Read the ZIP64 offset from the extra fields
      // The extra field 0x0001 is used for ZIP64 information
      const extraField = this._extraFields[0x0001];
      if (extraField) {
        const rawUncompressedSize = this.dataView.getUint32(24, true);
        const rawCompressedSize = this.dataView.getUint32(20, true);
        const rawOffset = this.dataView.getUint32(42, true);

        // Calculate the offset into the ZIP64 extra field
        let zip64Offset = 0;

        // If uncompressed size is 0xFFFFFFFF, skip 8 bytes
        if (rawUncompressedSize === MAX_VALUE_32BITS) {
          zip64Offset += 8;
        }

        // If compressed size is 0xFFFFFFFF, skip 8 bytes
        if (rawCompressedSize === MAX_VALUE_32BITS) {
          zip64Offset += 8;
        }

        // If the offset field is 0xFFFFFFFF, read it from ZIP64 extra field
        if (rawOffset === MAX_VALUE_32BITS) {
          return JSBI.toNumber(getBigInt64(extraField, zip64Offset, true));
        }

        return rawOffset;
      }

      throw new Error('ZIP64 extra field missing');
    } else {
      return this.dataView.getUint32(42, true);
    }
  }

  get zip64() {
    // Check if any of the 32-bit fields are MAX_VALUE_32BITS, indicating ZIP64 format
    // Use the raw values to avoid infinite recursion
    return (
      this.dataView.getUint32(24, true) === MAX_VALUE_32BITS || // uncompressed size
      this.dataView.getUint32(20, true) === MAX_VALUE_32BITS || // compressed size
      this.dataView.getUint32(42, true) === MAX_VALUE_32BITS // offset
    );
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
    const size = this.uncompressedSize;
    if (size === MAX_VALUE_32BITS) {
      // For ZIP64, read the actual size from the ZIP64 extra field
      const extraField = this._extraFields[0x0001];
      if (extraField) {
        return JSBI.toNumber(getBigInt64(extraField, 0, true));
      }
    }
    return size;
  }

  stream() {
    const self = this;
    const crc = new Crc32();
    let inflator;
    const onEnd = (ctrl) =>
      crc.get() === self.crc32
        ? ctrl.close()
        : ctrl.error(new Error("The crc32 checksum don't match"));

    return new ReadableStream({
      async start(ctrl) {
        // Need to read local header to get fileName + extraField length
        // Since they are not always the same length as in central dir...
        const ab = await self._fileLike
          .slice(self.offset + 26, self.offset + 30)
          .arrayBuffer();

        const bytes = new Uint8Array(ab);
        const localFileOffset = uint16e(bytes, 0) + uint16e(bytes, 2) + 30;
        const start = self.offset + localFileOffset;
        const end = start + self.compressedSize;
        this.reader = self._fileLike.slice(start, end).stream().getReader();

        if (self.compressionMethod) {
          inflator = new Inflate({ raw: true });
          inflator.onData = (chunk) => {
            crc.append(chunk);
            ctrl.enqueue(chunk);
          };
          inflator.onEnd = () => onEnd(ctrl);
        }
      },
      async pull(ctrl) {
        const v = await this.reader.read();
        if (inflator && !v.done) {
          inflator.push(v.value);
        } else if (v.done) {
          onEnd(ctrl);
        } else {
          ctrl.enqueue(v.value);
          crc.append(v.value);
        }
      },
    });
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

/**
 * Get a BigInt 64 from a DataView
 *
 * @param {DataView} view a dataview
 * @param {number} position the position
 * @param {boolean} littleEndian whether this uses littleEndian encoding
 * @returns BigInt
 */
function getBigInt64(view, position, littleEndian = false) {
  if ('getBigInt64' in DataView.prototype) {
    return view.getBigInt64(position, littleEndian);
  }

  let value = JSBI.BigInt(0);
  const isNegative =
    (view.getUint8(position + (littleEndian ? 7 : 0)) & 0x80) > 0;
  let carrying = true;

  for (let i = 0; i < 8; i++) {
    let byte = view.getUint8(position + (littleEndian ? i : 7 - i));

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
        JSBI.exponentiate(JSBI.BigInt(256), JSBI.BigInt(i)),
      ),
    );
  }

  if (isNegative) {
    value = JSBI.unaryMinus(value);
  }

  return value;
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
    const relativeOffsetEndOfZip64CentralDir = JSBI.toNumber(
      getBigInt64(dv, 8, true),
    ); // 8 bytes
    // const numberOfDisks = dv.getUint32(16, true) // 4 bytes

    const zip64centralBlob = file.slice(relativeOffsetEndOfZip64CentralDir, l);
    dv = new DataView(await zip64centralBlob.arrayBuffer());
    // const zip64EndOfCentralSize = dv.getBigInt64(4, true)
    // const diskNumber = dv.getUint32(16, true)
    // const diskWithCentralDirStart = dv.getUint32(20, true)
    // const centralDirRecordsOnThisDisk = dv.getBigInt64(24, true)
    fileslength = JSBI.toNumber(getBigInt64(dv, 32, true));
    centralDirSize = JSBI.toNumber(getBigInt64(dv, 40, true));
    centralDirOffset = JSBI.toNumber(getBigInt64(dv, 48, true));
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

const LOCAL_FILE_HEADER_SIGNATURE = 0x504b0304;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x504b0102;

/**
 * A streaming entry that represents a file being extracted from a ZIP stream
 */
class StreamEntry {
  constructor(localHeader, compressedChunks) {
    this.name = localHeader.name;
    this.compressionMethod = localHeader.compressionMethod;
    this.compressedSize = localHeader.compressedSize;
    this.uncompressedSize = localHeader.uncompressedSize;
    this.crc32 = localHeader.crc32;
    this.hasDataDescriptor = localHeader.hasDataDescriptor;
    this._compressedChunks = compressedChunks;
  }

  stream() {
    const self = this;
    const crc = new Crc32();
    let inflator;

    const onEnd = (ctrl) => {
      if (self.hasDataDescriptor) {
        // For streaming entries, we'll validate against the data descriptor when available
        ctrl.close();
      } else {
        const actualCrc = crc.get();
        const expectedCrc = self.crc32;
        // Convert both to unsigned 32-bit for comparison
        const actualUnsigned = actualCrc >>> 0;
        const expectedUnsigned = expectedCrc >>> 0;

        if (actualUnsigned === expectedUnsigned) {
          ctrl.close();
        } else {
          console.log('CRC check for', self.name);
          console.log(
            'Expected:',
            expectedCrc.toString(16),
            'Actual:',
            actualCrc.toString(16),
          );
          console.log('Compression method:', self.compressionMethod);
          ctrl.error(new Error("The crc32 checksum doesn't match"));
        }
      }
    };

    return new ReadableStream({
      start(ctrl) {
        if (self.compressionMethod === 8) {
          // DEFLATE
          inflator = new Inflate({ raw: true });
          inflator.onData = (chunk) => {
            crc.append(chunk);
            ctrl.enqueue(chunk);
          };
          inflator.onEnd = () => onEnd(ctrl);
        }
      },
      pull(ctrl) {
        if (!self._chunkIndex) {
          self._chunkIndex = 0;
        }

        if (self._chunkIndex >= self._compressedChunks.length) {
          if (!self._ended) {
            self._ended = true;
            if (inflator) {
              inflator.push(new Uint8Array(0), true); // Signal end
            } else {
              onEnd(ctrl);
            }
          }
          return;
        }

        const chunk = self._compressedChunks[self._chunkIndex];
        self._chunkIndex++;

        if (inflator) {
          inflator.push(chunk);
        } else {
          // Store method (no compression)
          crc.append(chunk);
          ctrl.enqueue(chunk);
        }
      },
    });
  }
}

/**
 * Parser for ZIP local file headers and data
 */
class StreamTransformer {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.state = 'seeking_header'; // 'seeking_header', 'reading_file_data', 'seeking_data_descriptor'
    this.currentEntry = null;
    this.remainingFileBytes = 0;
    this.fileDataStream = null;
    this.fileDataController = null;
  }

  /**
   * Combine two Uint8Arrays
   */
  static concat(a, b) {
    const result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
  }

  /**
   * Parse ZIP64 extra field from local header
   */
  static parseZip64ExtraField(extraFieldData, localHeader) {
    let offset = 0;
    while (offset < extraFieldData.length) {
      if (offset + 4 > extraFieldData.length) break;

      const id = uint16e(extraFieldData, offset);
      const len = uint16e(extraFieldData, offset + 2);
      offset += 4;

      if (id === 0x0001 && len >= 8) {
        // ZIP64 extra field
        if (
          localHeader.uncompressedSize === MAX_VALUE_32BITS ||
          localHeader.uncompressedSize === -1
        ) {
          const bigIntSize = getBigInt64(
            new DataView(
              extraFieldData.buffer,
              extraFieldData.byteOffset + offset,
              8,
            ),
            0,
            true,
          );
          // Safety check: ensure the size can be safely converted to a JavaScript number
          if (
            JSBI.greaterThan(bigIntSize, JSBI.BigInt(Number.MAX_SAFE_INTEGER))
          ) {
            throw new Error(
              'ZIP64 uncompressed size too large for JavaScript number',
            );
          }
          localHeader.uncompressedSize = JSBI.toNumber(bigIntSize);
        }
        if (
          (localHeader.compressedSize === MAX_VALUE_32BITS ||
            localHeader.compressedSize === -1) &&
          len >= 16
        ) {
          const bigIntSize = getBigInt64(
            new DataView(
              extraFieldData.buffer,
              extraFieldData.byteOffset + offset + 8,
              8,
            ),
            0,
            true,
          );
          // Safety check: ensure the size can be safely converted to a JavaScript number
          if (
            JSBI.greaterThan(bigIntSize, JSBI.BigInt(Number.MAX_SAFE_INTEGER))
          ) {
            throw new Error(
              'ZIP64 compressed size too large for JavaScript number',
            );
          }
          localHeader.compressedSize = JSBI.toNumber(bigIntSize);
        }
        break;
      }
      offset += len;
    }
  }

  /**
   * Parse a local file header from the buffer
   */
  static parseLocalHeader(buffer, offset = 0) {
    if (buffer.length - offset < 30) return null; // Need at least 30 bytes for local header

    const dv = new DataView(buffer.buffer, buffer.byteOffset + offset);
    const signature = dv.getUint32(0, false); // false for big endian (signatures are byte sequences)
    if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error('Invalid local file header signature');
    }

    const header = {
      versionNeeded: uint16e(buffer, offset + 4),
      bitFlag: uint16e(buffer, offset + 6),
      compressionMethod: uint16e(buffer, offset + 8),
      lastModTime: uint16e(buffer, offset + 10),
      lastModDate: uint16e(buffer, offset + 12),
      crc32:
        uint16e(buffer, offset + 14) | (uint16e(buffer, offset + 16) << 16),
      compressedSize:
        uint16e(buffer, offset + 18) | (uint16e(buffer, offset + 20) << 16),
      uncompressedSize:
        uint16e(buffer, offset + 22) | (uint16e(buffer, offset + 24) << 16),
      filenameLength: uint16e(buffer, offset + 26),
      extraFieldLength: uint16e(buffer, offset + 28),
    };

    header.hasDataDescriptor = (header.bitFlag & 0x0008) !== 0;

    // Store original values before ZIP64 parsing to detect ZIP64 entries
    const originalCompressedSize = header.compressedSize;
    const originalUncompressedSize = header.uncompressedSize;

    const totalHeaderSize =
      30 + header.filenameLength + header.extraFieldLength;
    if (buffer.length - offset < totalHeaderSize) return null; // Need complete header

    // Extract filename
    const nameBytes = buffer.slice(
      offset + 30,
      offset + 30 + header.filenameLength,
    );
    header.name = decoder.decode(nameBytes);

    // Parse extra fields (including ZIP64)
    if (header.extraFieldLength > 0) {
      const extraFieldData = buffer.slice(
        offset + 30 + header.filenameLength,
        offset + totalHeaderSize,
      );
      StreamTransformer.parseZip64ExtraField(extraFieldData, header);
    }

    // Determine if this is a ZIP64 entry
    header.isZip64 =
      originalCompressedSize === MAX_VALUE_32BITS ||
      originalUncompressedSize === MAX_VALUE_32BITS ||
      originalCompressedSize === -1 ||
      originalUncompressedSize === -1;

    return { header, headerSize: totalHeaderSize };
  }

  /**
   * Transform incoming ZIP bytes
   */
  async transform(chunk, controller) {
    this.buffer = StreamTransformer.concat(this.buffer, chunk);

    while (this.buffer.length > 0) {
      if (this.state === 'seeking_header') {
        // Check if we've reached the central directory (end of file entries)
        if (this.buffer.length >= 4) {
          const dv = new DataView(this.buffer.buffer, this.buffer.byteOffset);
          const signature = dv.getUint32(0, false);
          if (signature === CENTRAL_DIRECTORY_SIGNATURE) {
            // We've reached the central directory, stop processing
            break;
          }
        }

        // Try to parse a local file header
        const result = StreamTransformer.parseLocalHeader(this.buffer);
        if (!result) break; // Need more data

        const { header, headerSize } = result;

        // Remove header from buffer
        this.buffer = this.buffer.slice(headerSize);

        // Store the compressed data chunks for this file
        const compressedChunks = [];
        this.currentCompressedChunks = compressedChunks;

        // Create the stream entry
        const entry = new StreamEntry(header, compressedChunks);

        // Emit the entry
        controller.enqueue({ name: header.name, stream: () => entry.stream() });

        // Set up for reading file data
        this.currentEntry = header;
        this.remainingFileBytes = header.hasDataDescriptor
          ? Infinity
          : header.compressedSize;
        this.state = 'reading_file_data';
      } else if (this.state === 'reading_file_data') {
        if (this.remainingFileBytes === Infinity) {
          // Look for data descriptor
          if (this.buffer.length >= 16) {
            // Check for data descriptor signature
            for (let i = 0; i <= this.buffer.length - 16; i++) {
              const sig =
                uint16e(this.buffer, i) | (uint16e(this.buffer, i + 2) << 16);
              if (sig === DATA_DESCRIPTOR_SIGNATURE) {
                // Found data descriptor, add remaining data before it
                if (i > 0) {
                  this.currentCompressedChunks.push(this.buffer.slice(0, i));
                }

                // Skip the data descriptor (16 bytes for regular, 24 for ZIP64)
                const descriptorSize = this.currentEntry.isZip64 ? 24 : 16;
                this.buffer = this.buffer.slice(i + descriptorSize);
                this.state = 'seeking_header';
                this.currentEntry = null;
                this.currentCompressedChunks = null;
                break;
              }
            }

            if (this.state === 'reading_file_data') {
              // No data descriptor found yet, add most of the buffer but keep some for searching
              const keepBytes = 16;
              if (this.buffer.length > keepBytes) {
                const sendBytes = this.buffer.length - keepBytes;
                this.currentCompressedChunks.push(
                  this.buffer.slice(0, sendBytes),
                );
                this.buffer = this.buffer.slice(sendBytes);
              }
            }
          }
        } else {
          // Known file size, add data until we reach the limit
          const toSend = Math.min(this.buffer.length, this.remainingFileBytes);
          if (toSend > 0) {
            this.currentCompressedChunks.push(this.buffer.slice(0, toSend));
            this.buffer = this.buffer.slice(toSend);
            this.remainingFileBytes -= toSend;
          }

          if (this.remainingFileBytes === 0) {
            this.state = 'seeking_header';
            this.currentEntry = null;
            this.currentCompressedChunks = null;
          }
        }
      }
    }
  }

  /**
   * Handle end of stream
   */
  static flush() {
    // Nothing to do - chunks are already stored in arrays
  }
}

const ModernTransformStream =
  globalThis.TransformStream ||
  globalThis.WebStreamsPolyfill?.TransformStream ||
  PonyfillTransformStream;

/**
 * StreamReader - reads ZIP files from a ReadableStream
 */
class StreamReader extends ModernTransformStream {
  constructor() {
    super(new StreamTransformer());
  }
}

export default Reader;
export { StreamReader };
