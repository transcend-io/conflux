import Crc32 from "./crc.js";

const encoder = new TextEncoder();

class ZipTransformer {
  constructor() {
    this.files = Object.create(null);
    this.filenames = [];
    this.offset = 0n;
  }

  /**
   * [transform description]
   *
   * @param  {File}  entry [description]
   * @param  {ReadableStreamDefaultController}  ctrl
   * @return {Promise}       [description]
   */
  async transform(entry, ctrl) {
    let name = entry.name.trim();
    const date = new Date(
      typeof entry.lastModified === "undefined"
        ? Date.now()
        : entry.lastModified
    );

    if (entry.directory && !name.endsWith("/")) name += "/";
    if (this.files[name]) ctrl.abort(new Error("File already exists."));

    const nameBuf = encoder.encode(name);
    this.filenames.push(name);

    this.files[name] = {
      directory: !!entry.directory,
      nameBuf,
      offset: this.offset,
      comment: encoder.encode(entry.comment || ""),
      compressedLength: 0n,
      uncompressedLength: 0n,
      header: new Uint8Array(26)
    };

    const zipObject = this.files[name];

    const { header } = zipObject;
    const hdv = new DataView(header.buffer);
    const data = new Uint8Array(30 + nameBuf.length);

    hdv.setUint32(0, 0x14000808);
    hdv.setUint16(
      6,
      (((date.getHours() << 6) | date.getMinutes()) << 5) |
        (date.getSeconds() / 2),
      true
    );
    hdv.setUint16(
      8,
      ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) |
        date.getDate(),
      true
    );
    hdv.setUint16(22, nameBuf.length, true);
    data.set([80, 75, 3, 4]);
    data.set(header, 4);
    data.set(nameBuf, 30);

    this.offset += BigInt(data.length);
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
        zipObject.uncompressedLength += BigInt(chunk.length);
        zipObject.compressedLength += BigInt(chunk.length);
        ctrl.enqueue(chunk);
      }

      hdv.setUint32(10, zipObject.crc.get(), true);
      hdv.setUint32(14, Number(zipObject.compressedLength), true);
      hdv.setUint32(18, Number(zipObject.uncompressedLength), true);
      footer.set(header.subarray(10, 22), 4);
    }

    hdv.setUint16(22, nameBuf.length, true);

    this.offset += zipObject.compressedLength + 16n;

    ctrl.enqueue(footer);
  }

  /**
   * @param  {ReadableStreamDefaultController} ctrl
   */
  flush(ctrl) {
    let length = 0;
    let index = 56;
    let file;

    this.filenames.forEach(fileName => {
      file = this.files[fileName];
      length += 46 + file.nameBuf.length + file.comment.length;
    });

    const data = new Uint8Array(length + 56);
    const dv = new DataView(data.buffer);

    this.filenames.forEach(fileName => {
      file = this.files[fileName];
      dv.setUint32(index, 0x504b0102);
      dv.setUint16(index + 4, 0x1400);
      dv.setUint16(index + 32, file.comment.length, true);
      dv.setUint8(index + 38, file.directory ? 16 : 0);
      dv.setUint32(index + 42, Number(file.offset), true);
      data.set(file.header, index + 6);
      data.set(file.nameBuf, index + 46);
      data.set(file.comment, index + 46 + file.nameBuf.length);
      index += 46 + file.nameBuf.length + file.comment.length;
    });

    dv.setUint32(0, 0x6064b50, true); // Signature
    dv.setBigUint64(4, BigInt(length), true); // zip64EndOfCentralSize
    dv.setUint32(16, 0, true); // diskNumber
    dv.setUint32(20, 0, true); // diskWithCentralDirStart
    dv.setBigInt64(24, 1n, true); // centralDirRecordsOnThisDisk
    dv.setBigUint64(32, BigInt(this.filenames.length), true); // fileslength
    dv.setBigUint64(40, BigInt(length), true); // centralDirSize
    dv.setBigUint64(48, this.offset + 56n, true); // centralDirOffset

    // this.offset += 56n;
    // ctrl.enqueue(dc);
    ctrl.enqueue(data);

    // write zip64
    const dv2 = new DataView(new ArrayBuffer(42));
    dv2.setUint32(0, 0x504b0506);
    dv2.setBigUint64(8, this.offset, true);
    dv2.setUint32(16, 1, true); // nr of disks

    // write zip32
    dv2.setUint32(20 + 0, 0x504b0506);
    dv2.setUint16(20 + 8, this.filenames.length, true);
    dv2.setUint16(20 + 10, this.filenames.length, true);
    dv2.setUint32(20 + 12, length, true);
    dv2.setUint32(20 + 16, Number(this.offset + 56n), true);
    ctrl.enqueue(new Uint8Array(dv2.buffer));

    // cleanup
    this.files = Object.create(null);
    this.filenames = [];
    this.offset = 0;
  }
}

// eslint-disable-next-line no-undef
class Writer extends TransformStream {
  constructor() {
    super(new ZipTransformer());
  }
}

export default Writer;
