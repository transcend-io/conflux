import test from 'tape';
import { Writer, Reader } from './index.js';

function streamFrom(chunks) {
  return new ReadableStream({
    start(ctrl) {
      chunks.forEach(chunk => ctrl.enqueue(chunk))
      ctrl.close()
    }
  })
}

const date = +new Date('2012-02-05T15:40:48Z')
const dateMS = +new Date('2012-02-05T15:40:48.123Z')
const helloWorld = new File(['Hello World\n'], 'Hello.txt', { lastModified: dateMS })
const fileLikeUtf8 = { comment: `I'm a entry comment with utf8`, stream: () => new Response('€15\n').body, name: '€15.txt', lastModified: new Date('2020-01-27T16:55:59') }
const folder = { name: 'folder/', directory: true }

test('All in one big test', async (t) => {
  const zip = await new Response(streamFrom([
    helloWorld,
    fileLikeUtf8,
    folder,
  ]).pipeThrough(new Writer())).blob()

  let entry, it = Reader(zip)

  // entry 1, Writer accepts native File object
  entry = (await it.next()).value
  t.equal(entry.versionMadeBy, 20, 'versionMadeBy should be 20')
  t.equal(entry.versionNeeded, 20, 'versionNeeded should be 20')
  t.equal(entry.bitFlag, 2056, 'bitflag should be 2056')
  t.equal(entry.encrypted, false, 'entry is not encrypted')
  t.equal(entry.compressionMethod, 0, 'entry has no compression')
  t.equal(entry.crc32, 2962613731, 'crc checksum should be 2962613731')
  t.equal(entry.compressedSize, 12, 'compressed size should be same as size b/c no compression')
  t.equal(entry.filenameLength, 9, 'filenameLength is correct')
  t.equal(entry.extraFieldLength, 0, 'entry have no extra fields')
  t.equal(entry.commentLength, 0, 'native file object dont have comments')
  t.equal(entry.diskNumberStart, 0, 'diskNumberStart is 0')
  t.equal(entry.internalFileAttributes, 0, 'internalFileAttributes is 0')
  t.equal(entry.externalFileAttributes, 0, 'externalFileAttributes is 0')
  t.equal(entry.directory, false, 'directory should be false')
  t.equal(entry.offset, 0, 'first entry starts at offset 0')
  t.equal(entry.zip64, false, 'small entries are not zip64')
  t.equal(entry.comment, '', 'helloWorld have no comments')
  t.equal(+entry.lastModifiedDate, date, 'time is the same')
  t.equal(entry.lastModified, date, 'entries should not store ms')
  t.equal(entry.name, 'Hello.txt', 'entry name should be Hello.txt')
  t.equal(entry.size, 12, 'entry size should be 12')
  t.equal((await entry.arrayBuffer()).byteLength, 12, 'it can return an arrayBuffer')
  t.equal(await entry.text(), 'Hello World\n', 'getting the text is accurate')

  // entry 2, The rest should be similar to entry 1 (test the differences is enough)
  entry = (await it.next()).value
  t.equal(entry.name, '€15.txt', 'Name with utf8 chars works');
  t.equal(entry.comment, `I'm a entry comment with utf8`, `Entry should have a comment`);
  t.equal(await entry.text(), '€15\n', 'Text should be the same');
  t.equal(entry.filenameLength, 9, '€ takes up 3 bytes');
  t.ok(entry.offset > 30, '2nd entry should not have the same offset as first')

  // entry 3, it can create folders
  entry = (await it.next()).value
  t.equal(entry.directory, true, 'Entry should be a directory');
  t.equal(entry.name, 'folder/', 'Entry name should be folder/');

  t.end();
});
