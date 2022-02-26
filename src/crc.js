/* eslint-disable no-param-reassign */
class Crc32 {
  constructor() {
    this.crc = -1;
  }

  append(data) {
    let crc = this.crc | 0;
    const { table } = this;
    for (let offset = 0, len = data.length | 0; offset < len; offset++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xff];
    }
    this.crc = crc;
  }

  get() {
    return (this.crc ^ -1) >>> 0;
  }
}

Crc32.prototype.table = ((table, i, j, t) => {
  for (i = 0; i < 256; i++) {
    t = i;
    for (j = 0; j < 8; j++) {
      t = t & 1 ? (t >>> 1) ^ 0xedb88320 : t >>> 1;
    }
    table[i] = t;
  }
  return table;
})([], 0, 0, 0);

export default Crc32;
/* eslint-enable no-param-reassign */
