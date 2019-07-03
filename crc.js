class Crc32 {
  constructor () {
    this.crc = -1
  }

  append (data) {
    var crc = this.crc | 0; var table = this.table
    for (var offset = 0, len = data.length | 0; offset < len; offset++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF]
    }
    this.crc = crc
  }

  get () {
    return ~this.crc
  }
}
Crc32.prototype.table = (() => {
  var i; var j; var t; var table = []
  for (i = 0; i < 256; i++) {
    t = i
    for (j = 0; j < 8; j++) {
      t = (t & 1)
        ? (t >>> 1) ^ 0xEDB88320
        : t >>> 1
    }
    table[i] = t
  }
  return table
})()

export default Crc32
