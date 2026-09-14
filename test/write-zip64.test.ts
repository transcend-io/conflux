/* eslint-disable unicorn/no-await-expression-member */
import { assert } from '@esm-bundle/chai';
import { Reader, Writer } from '../src/index.js';
import type { Entry } from '../src/read.js';
import {
  ZipTransformer,
  dataDescriptor,
  endOfCentralDirectory,
  zip64ExtraField,
} from '../src/write.js';

declare global {
  interface Window {
    environment?: Record<string, string>;
  }
}

/** Real multi-gigabyte streaming tests are slow; opt in with FF_BIG_FIXTURES=run */
const runBigFixtures = self.environment?.['FF_BIG_FIXTURES'] === 'run';

const MAX_UINT32 = 0xff_ff_ff_ff;
const MAX_UINT32_BIG = BigInt(MAX_UINT32);
const FOUR_GIB = BigInt(0x1_00_00_00_00);

const SIG_CENTRAL_DIRECTORY = [0x50, 0x4b, 0x01, 0x02];
const SIG_END_OF_CENTRAL_DIRECTORY = [0x50, 0x4b, 0x05, 0x06];
const SIG_ZIP64_END_OF_CENTRAL_DIRECTORY = [0x50, 0x4b, 0x06, 0x06];
const SIG_ZIP64_LOCATOR = [0x50, 0x4b, 0x06, 0x07];

const dataView = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const signatureAt = (bytes: Uint8Array, index: number): number[] => [
  ...bytes.subarray(index, index + 4),
];

/**
 * A `Blob`-like view over a sparse layout: any byte not covered by a segment
 * reads as zero. Lets the Reader parse multi-gigabyte archives without
 * materialising the payload.
 */
interface SparseSegment {
  offset: bigint;
  bytes: Uint8Array;
}

function sparseFile(size: bigint, segments: SparseSegment[]): Blob {
  const sizeNumber = Number(size);
  const normalize = (
    position: number | undefined,
    fallback: number,
  ): number => {
    if (position === undefined) return fallback;
    if (position < 0) return Math.max(sizeNumber + position, 0);
    return Math.min(position, sizeNumber);
  };
  const slice = (start?: number, end?: number): Blob => {
    const from = normalize(start, 0);
    const to = Math.max(normalize(end, sizeNumber), from);
    const out = new Uint8Array(to - from);
    for (const segment of segments) {
      const segmentStart = Number(segment.offset);
      const segmentEnd = segmentStart + segment.bytes.length;
      const overlapStart = Math.max(from, segmentStart);
      const overlapEnd = Math.min(to, segmentEnd);
      if (overlapStart < overlapEnd) {
        out.set(
          segment.bytes.subarray(
            overlapStart - segmentStart,
            overlapEnd - segmentStart,
          ),
          overlapStart - from,
        );
      }
    }
    return new Blob([out]);
  };
  return { size: sizeNumber, slice } as unknown as Blob;
}

/** Collect everything a ZipTransformer enqueues via a stub controller. */
function collectingController(): {
  ctrl: TransformStreamDefaultController<Uint8Array>;
  chunks: Uint8Array[];
} {
  const chunks: Uint8Array[] = [];
  const ctrl = {
    desiredSize: 1,
    enqueue: (chunk: Uint8Array) => {
      chunks.push(chunk);
    },
    error: (reason: unknown) => {
      throw reason instanceof Error ? reason : new Error(String(reason));
    },
    terminate: () => {
      // no-op
    },
  } as unknown as TransformStreamDefaultController<Uint8Array>;
  return { ctrl, chunks };
}

/**
 * Stream a synthetic entry of `size` zero bytes plus a small trailing entry
 * through the real Writer, discarding payload bytes as they pass, and return
 * a sparse view of the resulting archive.
 */
async function writeBigArchive(size: bigint): Promise<{
  file: Blob;
  segments: SparseSegment[];
  archiveSize: bigint;
}> {
  const CHUNK_SIZE = 1 << 20;
  const zeroChunk = new Uint8Array(CHUNK_SIZE);
  const { readable, writable } = new Writer();

  const segments: SparseSegment[] = [];
  let archiveSize = BigInt(0);
  const reading = (async () => {
    const reader = readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value !== zeroChunk) {
        segments.push({ offset: archiveSize, bytes: value });
      }
      archiveSize += BigInt(value.length);
    }
  })();

  const writing = (async () => {
    const writer = writable.getWriter();
    let remaining = size;
    await writer.write({
      name: 'big.bin',
      stream: () =>
        new ReadableStream<Uint8Array>({
          pull(controller) {
            if (remaining <= BigInt(0)) {
              controller.close();
              return;
            }
            const length = Number(
              remaining < BigInt(CHUNK_SIZE) ? remaining : BigInt(CHUNK_SIZE),
            );
            controller.enqueue(
              length === CHUNK_SIZE ? zeroChunk : new Uint8Array(length),
            );
            remaining -= BigInt(length);
          },
        }),
    });
    await writer.write({
      name: 'small.txt',
      stream: () => new Blob(['after the big one\n']).stream(),
    });
    await writer.close();
  })();

  await Promise.all([reading, writing]);
  return { file: sparseFile(archiveSize, segments), segments, archiveSize };
}

describe('Writing - Zip64 record builders', () => {
  it('data descriptor uses 32-bit sizes below the 4 GiB boundary', () => {
    const size = MAX_UINT32_BIG - BigInt(1);
    const footer = dataDescriptor(0x12_34_56_78, size, size);
    const dv = dataView(footer);
    assert.equal(footer.length, 16);
    assert.equal(dv.getUint32(0), 0x50_4b_07_08);
    assert.equal(dv.getUint32(4, true), 0x12_34_56_78);
    assert.equal(dv.getUint32(8, true), MAX_UINT32 - 1);
    assert.equal(dv.getUint32(12, true), MAX_UINT32 - 1);
  });

  it('data descriptor uses 64-bit sizes at exactly 0xFFFFFFFF', () => {
    const footer = dataDescriptor(1, MAX_UINT32_BIG, MAX_UINT32_BIG);
    const dv = dataView(footer);
    assert.equal(footer.length, 24);
    assert.equal(dv.getBigUint64(8, true), MAX_UINT32_BIG);
    assert.equal(dv.getBigUint64(16, true), MAX_UINT32_BIG);
  });

  it('data descriptor uses 64-bit sizes above 4 GiB', () => {
    const size = FOUR_GIB + BigInt(5);
    const footer = dataDescriptor(1, size, size);
    const dv = dataView(footer);
    assert.equal(footer.length, 24);
    assert.equal(dv.getBigUint64(8, true), size);
    assert.equal(dv.getBigUint64(16, true), size);
  });

  it('zip64 extra field is omitted when nothing overflows', () => {
    const small = MAX_UINT32_BIG - BigInt(1);
    assert.equal(zip64ExtraField(small, small, small).length, 0);
    assert.equal(zip64ExtraField(BigInt(0), BigInt(0), BigInt(0)).length, 0);
  });

  it('zip64 extra field carries both sizes for a large entry at offset 0', () => {
    const size = FOUR_GIB + BigInt(1);
    const extra = zip64ExtraField(size, size, BigInt(0));
    const dv = dataView(extra);
    assert.equal(extra.length, 20);
    assert.equal(dv.getUint16(0, true), 0x00_01, 'header id');
    assert.equal(dv.getUint16(2, true), 16, 'data size');
    assert.equal(dv.getBigUint64(4, true), size, 'uncompressed size');
    assert.equal(dv.getBigUint64(12, true), size, 'compressed size');
  });

  it('zip64 extra field carries only the offset for a small entry past 4 GiB', () => {
    const offset = FOUR_GIB + BigInt(30);
    const extra = zip64ExtraField(BigInt(12), BigInt(12), offset);
    const dv = dataView(extra);
    assert.equal(extra.length, 12);
    assert.equal(dv.getUint16(2, true), 8, 'data size');
    assert.equal(dv.getBigUint64(4, true), offset, 'local header offset');
  });

  it('zip64 extra field carries all three fields, in spec order', () => {
    const size = MAX_UINT32_BIG;
    const offset = FOUR_GIB * BigInt(3);
    const extra = zip64ExtraField(size, size + BigInt(1), offset);
    const dv = dataView(extra);
    assert.equal(extra.length, 28);
    assert.equal(dv.getBigUint64(4, true), size);
    assert.equal(dv.getBigUint64(12, true), size + BigInt(1));
    assert.equal(dv.getBigUint64(20, true), offset);
  });

  it('classic end of central directory when nothing overflows', () => {
    const trailer = endOfCentralDirectory(3, BigInt(200), BigInt(1000), false);
    const dv = dataView(trailer);
    assert.equal(trailer.length, 22);
    assert.deepEqual(signatureAt(trailer, 0), SIG_END_OF_CENTRAL_DIRECTORY);
    assert.equal(dv.getUint16(8, true), 3);
    assert.equal(dv.getUint16(10, true), 3);
    assert.equal(dv.getUint32(12, true), 200);
    assert.equal(dv.getUint32(16, true), 1000);
  });

  it('zip64 end of central directory when the central directory starts past 4 GiB', () => {
    const cdLength = BigInt(77);
    const cdOffset = FOUR_GIB + BigInt(46);
    const trailer = endOfCentralDirectory(2, cdLength, cdOffset, false);
    const dv = dataView(trailer);
    assert.equal(trailer.length, 56 + 20 + 22);

    // Zip64 end of central directory record
    assert.deepEqual(
      signatureAt(trailer, 0),
      SIG_ZIP64_END_OF_CENTRAL_DIRECTORY,
    );
    assert.equal(dv.getBigUint64(4, true), BigInt(44), 'size of record');
    assert.equal(dv.getUint16(12, true), 45, 'version made by');
    assert.equal(dv.getUint16(14, true), 45, 'version needed');
    assert.equal(dv.getUint32(16, true), 0, 'this disk');
    assert.equal(dv.getUint32(20, true), 0, 'disk with central directory');
    assert.equal(dv.getBigUint64(24, true), BigInt(2), 'entries on disk');
    assert.equal(dv.getBigUint64(32, true), BigInt(2), 'total entries');
    assert.equal(dv.getBigUint64(40, true), cdLength, 'central directory size');
    assert.equal(
      dv.getBigUint64(48, true),
      cdOffset,
      'central directory offset',
    );

    // Zip64 end of central directory locator
    assert.deepEqual(signatureAt(trailer, 56), SIG_ZIP64_LOCATOR);
    assert.equal(dv.getUint32(60, true), 0, 'disk with zip64 EOCD');
    assert.equal(
      dv.getBigUint64(64, true),
      cdOffset + cdLength,
      'offset of zip64 EOCD',
    );
    assert.equal(dv.getUint32(72, true), 1, 'total disks');

    // Classic end of central directory record with sentinels
    assert.deepEqual(signatureAt(trailer, 76), SIG_END_OF_CENTRAL_DIRECTORY);
    assert.equal(dv.getUint16(84, true), 2, 'entry count still fits');
    assert.equal(dv.getUint32(88, true), 77, 'central directory size fits');
    assert.equal(
      dv.getUint32(92, true),
      MAX_UINT32,
      'central directory offset is the sentinel',
    );
  });

  it('zip64 end of central directory when an entry needed zip64', () => {
    const trailer = endOfCentralDirectory(1, BigInt(66), BigInt(100), true);
    assert.equal(trailer.length, 98);
    assert.deepEqual(
      signatureAt(trailer, 0),
      SIG_ZIP64_END_OF_CENTRAL_DIRECTORY,
    );
  });

  it('zip64 end of central directory when there are 0xFFFF or more entries', () => {
    const trailer = endOfCentralDirectory(
      0x1_00_00,
      BigInt(66),
      BigInt(100),
      false,
    );
    const dv = dataView(trailer);
    assert.equal(trailer.length, 98);
    assert.equal(dv.getBigUint64(32, true), BigInt(0x1_00_00), 'total entries');
    assert.equal(dv.getUint16(84, true), 0xff_ff, 'entry count sentinel');
    assert.equal(dv.getUint16(86, true), 0xff_ff, 'entry count sentinel');
  });
});

describe('Writing - Zip64 archives', () => {
  it('small entry written past the 4 GiB offset round-trips through the Reader', async () => {
    const seededOffset = FOUR_GIB + BigInt(1234);
    const transformer = new ZipTransformer();
    transformer.offset = seededOffset;

    const { ctrl, chunks } = collectingController();
    await transformer.transform(
      {
        name: 'late.txt',
        lastModified: +new Date('2020-01-27T16:55:59'),
        stream: () => new Blob(['Hello Zip64\n']).stream(),
      },
      ctrl,
    );
    transformer.flush(ctrl);

    const tail = new Uint8Array(
      chunks.reduce((total, chunk) => total + chunk.length, 0),
    );
    let position = 0;
    for (const chunk of chunks) {
      tail.set(chunk, position);
      position += chunk.length;
    }

    const localHeaderLength = 30 + 'late.txt'.length;
    const dataLength = 'Hello Zip64\n'.length;
    const descriptorLength = 16;
    const cdStart = localHeaderLength + dataLength + descriptorLength;
    const cdLength = 46 + 'late.txt'.length + 12;
    assert.equal(
      tail.length,
      cdStart + cdLength + 56 + 20 + 22,
      'layout: local header, data, 16-byte descriptor, central directory with 12-byte extra, zip64 EOCD, locator, EOCD',
    );
    assert.deepEqual(signatureAt(tail, cdStart), SIG_CENTRAL_DIRECTORY);
    const cd = dataView(tail.subarray(cdStart, cdStart + cdLength));
    assert.equal(cd.getUint16(4, true), 45, 'version made by');
    assert.equal(cd.getUint16(6, true), 45, 'version needed');
    assert.equal(cd.getUint32(20, true), dataLength, 'compressed size fits');
    assert.equal(cd.getUint32(24, true), dataLength, 'uncompressed size fits');
    assert.equal(cd.getUint16(30, true), 12, 'extra field length');
    assert.equal(cd.getUint32(42, true), MAX_UINT32, 'offset sentinel');
    assert.deepEqual(
      signatureAt(tail, cdStart + cdLength),
      SIG_ZIP64_END_OF_CENTRAL_DIRECTORY,
    );

    const file = sparseFile(seededOffset + BigInt(tail.length), [
      { offset: seededOffset, bytes: tail },
    ]);
    const it = Reader(file);
    const entry = (await it.next()).value as Entry;
    assert.equal(entry.name, 'late.txt');
    assert.equal(entry.zip64, true, 'entry carries a zip64 extra field');
    assert.equal(entry.offset, Number(seededOffset), 'offset read from zip64');
    assert.equal(entry.size, dataLength);
    assert.equal(entry.compressedSize, dataLength);
    assert.equal(await entry.text(), 'Hello Zip64\n');
    assert.ok((await it.next()).done);
  });

  it('archive with exactly 0xFFFF entries round-trips through a Zip64 end of central directory', async () => {
    const count = 0xff_ff;
    const transformer = new ZipTransformer();
    const { ctrl, chunks } = collectingController();
    const lastModified = +new Date('2020-01-27T16:55:59');
    for (let index = 0; index < count; index++) {
      await transformer.transform(
        { name: `d${String(index)}`, directory: true, lastModified },
        ctrl,
      );
    }
    transformer.flush(ctrl);

    const trailer = chunks.at(-1);
    if (!trailer) throw new Error('trailer not found');
    assert.equal(trailer.length, 56 + 20 + 22, 'zip64 EOCD + locator + EOCD');
    const tdv = dataView(trailer);
    assert.deepEqual(
      signatureAt(trailer, 0),
      SIG_ZIP64_END_OF_CENTRAL_DIRECTORY,
    );
    assert.equal(tdv.getBigUint64(32, true), BigInt(count), 'total entries');
    assert.equal(
      tdv.getUint16(76 + 8, true),
      0xff_ff,
      'classic count sentinel',
    );

    let read = 0;
    let last: Entry | undefined;
    const archive = new Blob(chunks as unknown as BlobPart[]);
    for await (const entry of Reader(archive)) {
      last = entry;
      read++;
    }
    assert.equal(read, count, 'entry count comes from the zip64 EOCD');
    assert.equal(last?.name, `d${String(count - 1)}/`);
    assert.equal(last?.directory, true);
  });

  (runBigFixtures ? it : it.skip)(
    'entry of exactly 0xFFFFFFFF bytes uses zip64 sizes and pushes the next entry past 4 GiB',
    async () => {
      const { file, segments, archiveSize } =
        await writeBigArchive(MAX_UINT32_BIG);
      assert.ok(archiveSize > FOUR_GIB, 'archive crosses 4 GiB');

      const bigHeaderLength = 30 + 'big.bin'.length;
      const descriptor = segments.find(
        (segment) =>
          segment.offset === BigInt(bigHeaderLength) + MAX_UINT32_BIG,
      );
      if (!descriptor) throw new Error('data descriptor not found');
      assert.equal(descriptor.bytes.length, 24, '64-bit data descriptor');
      const ddv = dataView(descriptor.bytes);
      assert.equal(ddv.getUint32(0), 0x50_4b_07_08);
      assert.equal(ddv.getBigUint64(8, true), MAX_UINT32_BIG);
      assert.equal(ddv.getBigUint64(16, true), MAX_UINT32_BIG);

      const it = Reader(file);
      let entry = (await it.next()).value as Entry;
      assert.equal(entry.name, 'big.bin');
      assert.equal(entry.zip64, true);
      assert.equal(entry.offset, 0);
      assert.equal(entry.size, MAX_UINT32_BIG);
      assert.equal(entry.compressedSize, MAX_UINT32);
      assert.equal(entry.extraFieldLength, 20, 'both sizes in zip64 extra');

      entry = (await it.next()).value as Entry;
      assert.equal(entry.name, 'small.txt');
      assert.equal(entry.zip64, true, 'offset overflowed');
      assert.equal(
        entry.offset,
        bigHeaderLength + MAX_UINT32 + 24,
        'offset read from zip64 extra',
      );
      assert.equal(
        entry.extraFieldLength,
        12,
        'only the offset in zip64 extra',
      );
      assert.equal(await entry.text(), 'after the big one\n');
      assert.ok((await it.next()).done);
    },
  );

  (runBigFixtures ? it : it.skip)(
    'entry larger than 4 GiB round-trips through the Reader',
    async () => {
      const size = FOUR_GIB + BigInt(1 << 20);
      const { file } = await writeBigArchive(size);

      const it = Reader(file);
      let entry = (await it.next()).value as Entry;
      assert.equal(entry.name, 'big.bin');
      assert.equal(entry.zip64, true);
      assert.equal(entry.size, size);
      assert.equal(entry.compressedSize, Number(size));

      entry = (await it.next()).value as Entry;
      assert.equal(entry.name, 'small.txt');
      assert.equal(await entry.text(), 'after the big one\n');
      assert.ok((await it.next()).done);
    },
  );

  (runBigFixtures ? it : it.skip)(
    'entry just under 0xFFFFFFFF bytes stays classic while the archive goes zip64',
    async () => {
      const size = MAX_UINT32_BIG - BigInt(1);
      const { file, segments } = await writeBigArchive(size);

      const bigHeaderLength = 30 + 'big.bin'.length;
      const descriptor = segments.find(
        (segment) => segment.offset === BigInt(bigHeaderLength) + size,
      );
      if (!descriptor) throw new Error('data descriptor not found');
      assert.equal(descriptor.bytes.length, 16, '32-bit data descriptor');

      const it = Reader(file);
      let entry = (await it.next()).value as Entry;
      assert.equal(entry.name, 'big.bin');
      assert.equal(entry.zip64, false, 'sizes and offset all fit in 32 bits');
      assert.equal(entry.size, MAX_UINT32 - 1);

      entry = (await it.next()).value as Entry;
      assert.equal(entry.name, 'small.txt');
      assert.equal(entry.zip64, true, 'offset overflowed');
      assert.equal(entry.offset, bigHeaderLength + MAX_UINT32 - 1 + 16);
      assert.equal(await entry.text(), 'after the big one\n');
      assert.ok((await it.next()).done);
    },
  );
});
