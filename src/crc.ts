class Crc32 {
  crc: number;

  constructor() {
    this.crc = -1;
  }

  append(data: Uint8Array): void {
    // eslint-disable-next-line unicorn/prefer-math-trunc
    let crc = this.crc | 0;
    // @ts-expect-error - table is not defined on the instance
    const { table } = this;
    // eslint-disable-next-line unicorn/prefer-math-trunc
    for (let offset = 0, length = data.length | 0; offset < length; offset++) {
      const byte = data[offset];
      if (byte === undefined) {
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const tableEntry = table[(crc ^ byte) & 0xff];
      if (tableEntry === undefined) {
        continue;
      }
      crc = (crc >>> 8) ^ tableEntry;
    }
    this.crc = crc;
  }

  get(): number {
    return (this.crc ^ -1) >>> 0;
  }
}

Crc32.prototype.table = ((
  table: number[],
  // eslint-disable-next-line unicorn/prevent-abbreviations
  i: number,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  j: number,
  t: number,
) => {
  for (i = 0; i < 256; i++) {
    t = i;
    for (j = 0; j < 8; j++) {
      t = t & 1 ? (t >>> 1) ^ 0xed_b8_83_20 : t >>> 1;
    }
    table[i] = t;
  }
  return table;
})([], 0, 0, 0);

export default Crc32;
