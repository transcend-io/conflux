// Generate CRC32 lookup table
function generateCrcTable(): number[] {
  const table: number[] = [];
  for (let index = 0; index < 256; index++) {
    let t = index;
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      t = t & 1 ? (t >>> 1) ^ 0xed_b8_83_20 : t >>> 1;
    }
    table[index] = t;
  }
  return table;
}

class Crc32 {
  private crc: number;
  private static readonly table: number[] = generateCrcTable();

  constructor() {
    this.crc = -1;
  }

  public append(data: Uint8Array): void {
    let crc = Math.trunc(this.crc);
    const { table } = Crc32;
    for (let offset = 0, length = Math.trunc(data.length); offset < length; offset++) {
      const byte = data[offset];
      if (byte === undefined) {
        continue;
      }
      const tableEntry = table[(crc ^ byte) & 0xff];
      if (tableEntry === undefined) {
        continue;
      }
      crc = (crc >>> 8) ^ tableEntry;
    }
    this.crc = crc;
  }

  public get(): number {
    return (this.crc ^ -1) >>> 0;
  }
}

export default Crc32;
