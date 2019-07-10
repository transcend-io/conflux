class Crc32 {
  constructor() {
    this.crc = -1;
  }

  append(data) {
    let crc = this.crc | 0;
    const { table } = this;
    for (let offset = 0, len = data.length | 0; offset < len; offset += 1) {
      crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF];
    }
    this.crc = crc;
  }

  get() {
    return ~this.crc;
  }
}

Crc32.prototype.table = (() => {
  let i; let j; let t; const table = [];
  for (i = 0; i < 256; i += 1) {
    t = i;
    for (j = 0; j < 8; j += 1) {
      t = (t & 1)
        ? (t >>> 1) ^ 0xEDB88320
        : t >>> 1;
    }
    table[i] = t;
  }
  return table;
})();

export default Crc32;
