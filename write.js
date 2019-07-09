import Crc32 from './crc.js'

const encoder = new TextEncoder()

function getDataHelper (byteLength) {
  const uint8 = new Uint8Array(byteLength)
  return {
    array: uint8,
    view: new DataView(uint8.buffer)
  }
}

const wm = new WeakMap()

const transformer = {
  /**
   * @param  {ReadableStreamDefaultController} ctrl
   */
  start (ctrl) {
    wm.set(ctrl, {
      files: Object.create(null),
      filenames: [],
      offset: 0
    })
  },

  /**
   * [transform description]
   *
   * @param  {File}  entry [description]
   * @param  {ReadableStreamDefaultController}  ctrl
   * @return {Promise}       [description]
   */
  async transform (entry, ctrl) {
    let name = entry.name.trim()
    const date = new Date(typeof entry.lastModified === 'undefined' ? Date.now() : entry.lastModified)
    const _ = wm.get(ctrl)

    if (entry.directory && !name.endsWith('/')) name += '/'
    if (_.files[name]) ctrl.abort(new Error('File already exists.'))

    const nameBuf = encoder.encode(name)
    _.filenames.push(name)

    const zipObject = _.files[name] = {
      directory: !!entry.directory,
      nameBuf,
      offset: _.offset,
      comment: encoder.encode(entry.comment || ''),
      compressedLength: 0,
      uncompressedLength: 0,
      header: getDataHelper(26)
    }

    const { header } = zipObject
    const data = getDataHelper(30 + nameBuf.length)

    if (entry.level !== 0 && !entry.directory) {
      header.view.setUint16(4, 0x0800)
    }

    header.view.setUint32(0, 0x14000808)
    header.view.setUint16(6, (((date.getHours() << 6) | date.getMinutes()) << 5) | date.getSeconds() / 2, true)
    header.view.setUint16(8, ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) | date.getDate(), true)
    header.view.setUint16(22, nameBuf.length, true)

    data.view.setUint32(0, 0x504b0304)
    data.array.set(header.array, 4)
    data.array.set(nameBuf, 30)

    _.offset += data.array.length
    ctrl.enqueue(data.array)

    const footer = getDataHelper(16)
    footer.view.setUint32(0, 0x504b0708)

    if (entry.stream) {
      zipObject.crc = new Crc32()
      const reader = entry.stream().getReader()

      while (true) {
        const it = await reader.read()
        if (it.done) break
        const chunk = it.value
        zipObject.crc.append(chunk)
        zipObject.uncompressedLength += chunk.length
        zipObject.compressedLength += chunk.length
        ctrl.enqueue(chunk)
      }

      zipObject.header.view.setUint32(10, zipObject.crc.get(), true)
      zipObject.header.view.setUint32(14, zipObject.compressedLength, true)
      zipObject.header.view.setUint32(18, zipObject.uncompressedLength, true)
      footer.view.setUint32(4, zipObject.crc.get(), true)
      footer.view.setUint32(8, zipObject.compressedLength, true)
      footer.view.setUint32(12, zipObject.uncompressedLength, true)
    }

    _.offset += zipObject.compressedLength + 16

    ctrl.enqueue(footer.array)
  },

  /**
   * @param  {ReadableStreamDefaultController} ctrl
   */
  flush (ctrl) {
    const _ = wm.get(ctrl)
    wm.delete(ctrl)

    let length = 0
    let index = 0
    let file

    for (let fileName of _.filenames) {
      file = _.files[fileName]
      length += 46 + file.nameBuf.length + file.comment.length
    }

    const data = getDataHelper(length + 22)
    for (let fileName of _.filenames) {
      file = _.files[fileName]
      data.view.setUint32(index, 0x504b0102)
      data.view.setUint16(index + 4, 0x1400)
      data.array.set(file.header.array, index + 6)
      data.view.setUint16(index + 32, file.comment.length, true)
      if (file.directory) {
        data.view.setUint8(index + 38, 0x10)
      }
      data.view.setUint32(index + 42, file.offset, true)
      data.array.set(file.nameBuf, index + 46)
      data.array.set(file.comment, index + 46 + file.nameBuf.length)
      index += 46 + file.nameBuf.length + file.comment.length
    }
    data.view.setUint32(index, 0x504b0506)
    data.view.setUint16(index + 8, _.filenames.length, true)
    data.view.setUint16(index + 10, _.filenames.length, true)
    data.view.setUint32(index + 12, length, true)
    data.view.setUint32(index + 16, _.offset, true)
    ctrl.enqueue(data.array)
  }
}

class Writer extends TransformStream {
  constructor () {
    super(transformer)
  }
}

export default Writer
