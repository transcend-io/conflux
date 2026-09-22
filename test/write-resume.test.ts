import { assert } from '@esm-bundle/chai';

import { Reader, Writer } from '../src/index.js';
import type {
  ZipCheckpoint,
  ZipEntryCheckpoint,
  ZipTransformerEntry,
  ZipTransformerOptions,
} from '../src/write.js';

const LAST_MODIFIED = +new Date('2024-06-01T12:34:56Z');

const textEntry = (
  name: string,
  text: string,
  comment?: string,
): ZipTransformerEntry => ({
  name,
  lastModified: LAST_MODIFIED,
  ...(comment === undefined ? {} : { comment }),
  stream: () => new Blob([text]).stream(),
});

const ENTRIES: ZipTransformerEntry[] = [
  textEntry('first.txt', 'first file body\n'),
  textEntry('nested/second.txt', 'second file body, a bit longer\n', 'note'),
  { name: 'empty-dir/', directory: true, lastModified: LAST_MODIFIED },
  textEntry('third.txt', 'third\n'),
];

interface WriteResult {
  bytes: Uint8Array;
  checkpoints: ZipEntryCheckpoint[];
  offsets: string[];
}

const entrySource = (
  entries: ZipTransformerEntry[],
): ReadableStream<ZipTransformerEntry> =>
  new ReadableStream<ZipTransformerEntry>({
    start(ctrl) {
      for (const entry of entries) ctrl.enqueue(entry);
      ctrl.close();
    },
  });

/** Pipe entries through a Writer and collect its output plus checkpoints. */
const writeAll = async (
  entries: ZipTransformerEntry[],
  options: ZipTransformerOptions = {},
): Promise<WriteResult> => {
  const checkpoints: ZipEntryCheckpoint[] = [];
  const offsets: string[] = [];
  const writer = new Writer(undefined, {
    ...options,
    onEntryComplete: (checkpoint, archiveOffset) => {
      checkpoints.push(checkpoint);
      offsets.push(archiveOffset);
      options.onEntryComplete?.(checkpoint, archiveOffset);
    },
  });
  const bytes = new Uint8Array(
    await new Response(entrySource(entries).pipeThrough(writer)).arrayBuffer(),
  );
  return { bytes, checkpoints, offsets };
};

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

const lastOf = <T>(values: T[]): T => {
  const value = values.at(-1);
  if (value === undefined) {
    throw new Error('expected a non-empty array');
  }
  return value;
};

const at = <T>(values: T[], index: number): T => {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`expected an element at index ${String(index)}`);
  }
  return value;
};

describe('Writer resume', () => {
  it('reports a checkpoint after every entry with the running archive offset', async () => {
    const { bytes, checkpoints, offsets } = await writeAll(ENTRIES);

    assert.lengthOf(checkpoints, ENTRIES.length);
    assert.deepEqual(
      checkpoints.map((c) => c.name),
      ['first.txt', 'nested/second.txt', 'empty-dir/', 'third.txt'],
    );
    const first = at(checkpoints, 0);
    assert.equal(first.offset, '0');
    assert.equal(first.compressedLength, '16');
    assert.equal(first.uncompressedLength, '16');
    assert.notEqual(first.crc32, 0);
    assert.equal(at(checkpoints, 1).comment, 'note');
    assert.isTrue(at(checkpoints, 2).directory);
    assert.equal(at(checkpoints, 2).crc32, 0);

    // each checkpoint's offset is the previous archiveOffset
    for (let index = 1; index < checkpoints.length; index += 1) {
      assert.equal(at(checkpoints, index).offset, at(offsets, index - 1));
    }
    // the last archive offset is where the central directory begins
    const eocd = bytes.length - 22;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert.equal(String(dv.getUint32(eocd + 16, true)), lastOf(offsets));
  });

  it('produces a byte-identical archive when resumed after a completed entry', async () => {
    const single = await writeAll(ENTRIES);

    // First pass: write the first two entries, capture the checkpoint.
    const firstPass = await writeAll(ENTRIES.slice(0, 2));
    const resumeOffset = lastOf(firstPass.offsets);
    // The bytes the sink would have on disk: everything up to the last
    // completed data descriptor, excluding the central directory.
    const onDisk = firstPass.bytes.subarray(0, Number(resumeOffset));

    // Second pass: seed the writer and write the remaining entries.
    const secondPass = await writeAll(ENTRIES.slice(2), {
      resumeFrom: { offset: resumeOffset, entries: firstPass.checkpoints },
    });

    const resumed = concat(onDisk, secondPass.bytes);
    assert.equal(resumed.length, single.bytes.length);
    assert.deepEqual([...resumed], [...single.bytes]);

    // the resumed writer's checkpoints continue from the seed
    assert.equal(at(secondPass.checkpoints, 0).offset, resumeOffset);
    assert.deepEqual(
      [...firstPass.checkpoints, ...secondPass.checkpoints],
      single.checkpoints,
    );

    // and the archive reads back with every entry intact
    const names: string[] = [];
    const bodies: string[] = [];
    for await (const entry of Reader(new Blob([resumed]))) {
      names.push(entry.name);
      bodies.push(entry.directory ? '' : await entry.text());
    }
    assert.deepEqual(names, [
      'first.txt',
      'nested/second.txt',
      'empty-dir/',
      'third.txt',
    ]);
    assert.equal(at(bodies, 0), 'first file body\n');
    assert.equal(at(bodies, 3), 'third\n');
  });

  it('round-trips checkpoints through JSON', async () => {
    const firstPass = await writeAll(ENTRIES.slice(0, 1));
    const serialized = JSON.stringify({
      offset: at(firstPass.offsets, 0),
      entries: firstPass.checkpoints,
    });
    const resumeFrom = JSON.parse(serialized) as ZipCheckpoint;

    const secondPass = await writeAll(ENTRIES.slice(1), { resumeFrom });
    const single = await writeAll(ENTRIES);
    const resumed = concat(
      firstPass.bytes.subarray(0, Number(at(firstPass.offsets, 0))),
      secondPass.bytes,
    );
    assert.deepEqual([...resumed], [...single.bytes]);
  });

  it('rejects a checkpoint that repeats an entry name', () => {
    const entry: ZipEntryCheckpoint = {
      name: 'dup.txt',
      offset: '0',
      compressedLength: '1',
      uncompressedLength: '1',
      crc32: 1,
      dosTime: 0,
      dosDate: 0,
      directory: false,
      comment: '',
    };
    assert.throws(
      () =>
        new Writer(undefined, {
          resumeFrom: { offset: '100', entries: [entry, entry] },
        }),
      /Duplicate entry/,
    );
  });

  it('refuses to write an entry whose name is already in the resume seed', async () => {
    const firstPass = await writeAll(ENTRIES.slice(0, 1));
    const writer = new Writer(undefined, {
      resumeFrom: {
        offset: at(firstPass.offsets, 0),
        entries: firstPass.checkpoints,
      },
    });
    let failure: unknown;
    try {
      const reader = entrySource(ENTRIES.slice(0, 1))
        .pipeThrough(writer)
        .getReader();
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (error) {
      failure = error;
    }
    assert.instanceOf(failure, Error);
    assert.match(failure.message, /already exists/);
  });
});
