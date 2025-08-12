/* eslint-disable unicorn/no-await-expression-member */
import { assert } from '@esm-bundle/chai';
import { Writer, Reader } from '../src/index.js';
import type { Entry } from '../src/read.js';
import type { ZipTransformerEntry } from '../src/write.js';

// function streamFrom(chunks) {
//   return new ReadableStream({
//     start(ctrl) {
//       chunks.forEach((chunk) => ctrl.enqueue(chunk));
//       ctrl.close();
//     },
//   });
// }

const date = +new Date('2012-02-05T15:40:48Z');
const dateMS = +new Date('2012-02-05T15:40:48.123Z');
const helloWorld = new File(['Hello World\n'], 'Hello.txt', {
  lastModified: dateMS,
});
const fileLikeUtf8: ZipTransformerEntry = {
  comment: "I'm a entry comment with utf8",
  stream: () => {
    const body = new Response('€15\n').body;
    if (!body) {
      throw new Error('Response body is null');
    }
    return body;
  },
  name: '€15.txt',
  lastModified: +new Date('2020-01-27T16:55:59'),
};
const folder = { name: 'folder/', directory: true };

it('Writing - All in one big test', async () => {
  const { readable, writable } = new Writer();

  const reading = (async () => {
    const chunks = [];
    const reader = readable.getReader();
    for (;;) {
      const v = await reader.read();
      if (v.done) break;
      chunks.push(v.value);
    }
    return new Blob(chunks as BlobPart[]);
  })();

  const writing = (async () => {
    const writer = writable.getWriter();
    await writer.write(helloWorld);
    await writer.write(fileLikeUtf8);
    await writer.write(folder);
    await writer.close();
  })();

  const [blob] = await Promise.all([reading, writing]);

  let entry: Entry;
  const it = Reader(blob);

  // entry 1, Writer accepts native File object
  entry = (await it.next()).value as Entry;
  assert.equal(entry.versionMadeBy, 20, 'versionMadeBy should be 20');
  assert.equal(entry.versionNeeded, 20, 'versionNeeded should be 20');
  assert.equal(entry.bitFlag, 2056, 'bitflag should be 2056');
  assert.equal(entry.encrypted, false, 'entry is not encrypted');
  assert.equal(entry.compressionMethod, 0, 'entry has no compression');
  assert.equal(entry.crc32, 2_962_613_731, 'crc checksum should be 2962613731');
  assert.equal(
    entry.compressedSize,
    12,
    'compressed size should be same as size b/c no compression',
  );
  assert.equal(entry.filenameLength, 9, 'filenameLength is correct');
  assert.equal(entry.extraFieldLength, 0, 'entry have no extra fields');
  assert.equal(entry.commentLength, 0, 'native file object dont have comments');
  assert.equal(entry.diskNumberStart, 0, 'diskNumberStart is 0');
  assert.equal(entry.internalFileAttributes, 0, 'internalFileAttributes is 0');
  assert.equal(entry.externalFileAttributes, 0, 'externalFileAttributes is 0');
  assert.equal(entry.directory, false, 'directory should be false');
  assert.equal(entry.offset, 0, 'first entry starts at offset 0');
  assert.equal(entry.zip64, false, 'small entries are not zip64');
  assert.equal(entry.comment, '', 'helloWorld have no comments');
  assert.equal(+entry.lastModifiedDate, date, 'time is the same');
  assert.equal(entry.lastModified, date, 'entries should not store ms');
  assert.equal(entry.name, 'Hello.txt', 'entry name should be Hello.txt');
  assert.equal(entry.size, 12, 'entry size should be 12');
  assert.equal(
    (await entry.arrayBuffer()).byteLength,
    12,
    'it can return an arrayBuffer',
  );
  assert.equal(
    await entry.text(),
    'Hello World\n',
    'getting the text is accurate',
  );

  // entry 2, The rest should be similar to entry 1 (test the differences is enough)
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, '€15.txt', 'Name with utf8 chars works');
  assert.equal(
    entry.comment,
    "I'm a entry comment with utf8",
    'Entry should have a comment',
  );
  assert.equal(await entry.text(), '€15\n', 'Text should be the same');
  assert.equal(entry.filenameLength, 9, '€ takes up 3 bytes');
  assert.ok(
    entry.offset > 30,
    '2nd entry should not have the same offset as first',
  );

  // entry 3, it can create folders
  entry = (await it.next()).value as Entry;
  assert.equal(entry.directory, true, 'Entry should be a directory');
  assert.equal(entry.name, 'folder/', 'Entry name should be folder/');
});
