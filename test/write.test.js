import test from 'tape';
import { Writer, Reader } from '../src/index.js';

// Constants
const ABORT_MESSAGE = 'This is a bad stream';

function writeStuff(writable, inputReadable) {
  const writer = writable.getWriter();
  writer.write({
    name: "/chonks.txt",
    stream: () => inputReadable,
  });
  writer.close();
  return writer;
}

function getInputReadable({
  chunks = [[1, 2, 3, 4], [5, 6, 7, 8]],
  abort = false,
  long = false,
} = {}) {
  let cancelReason;

  const inputReadable = new ReadableStream({
    start(ctrl) {
      if (long) {
        for (let x = 0; x < 1000; x++) ctrl.enqueue(chunks[0]);
      }

      if (abort) {
        ctrl.error(ABORT_MESSAGE);
      } else {
        chunks.forEach((chunk) => ctrl.enqueue(chunk));
        ctrl.close();
      }
    },

    cancel(reason) {
      cancelReason = reason;
    }
  });

  inputReadable.cancelReason = cancelReason;
  return inputReadable;
}

function getOutputWritable({ abort = false } = {}) {
  let chunks = [];
  let abortReason;
  let closed;

  const outputWritable = new WritableStream({
    start(ctrl) {
      closed = false;
      if (abort) ctrl.error(ABORT_MESSAGE);
    },

    write(chunk) {
      chunks.push(chunk);
    },

    abort(reason) {
      abortReason = reason;
    },

    close() {
      closed = true
    }
  });

  outputWritable.outputChunks = chunks;
  outputWritable.abortReason = abortReason;
  outputWritable.closed = closed;
  return outputWritable;
}

const date = +new Date('2012-02-05T15:40:48Z');
const dateMS = +new Date('2012-02-05T15:40:48.123Z');
const helloWorld = new File(['Hello World\n'], 'Hello.txt', {
  lastModified: dateMS,
});
const fileLikeUtf8 = {
  comment: `I'm a entry comment with utf8`,
  stream: () => new Response('€15\n').body,
  name: '€15.txt',
  lastModified: new Date('2020-01-27T16:55:59'),
};
const folder = { name: 'folder/', directory: true };

test('Writing - All in one big test', async (t) => {
  const { readable, writable } = new Writer();
  const writer = writable.getWriter();
  writer.write(helloWorld);
  writer.write(fileLikeUtf8);
  writer.write(folder);
  writer.close();

  const chunks = [];
  const reader = readable.getReader();
  for (;;) {
    const v = await reader.read();
    if (v.done) break;
    chunks.push(v.value);
  }

  let entry;
  const it = Reader(new Blob(chunks));

  // entry 1, Writer accepts native File object
  entry = (await it.next()).value;
  t.equal(entry.versionMadeBy, 20, 'versionMadeBy should be 20');
  t.equal(entry.versionNeeded, 20, 'versionNeeded should be 20');
  t.equal(entry.bitFlag, 2056, 'bitflag should be 2056');
  t.equal(entry.encrypted, false, 'entry is not encrypted');
  t.equal(entry.compressionMethod, 0, 'entry has no compression');
  t.equal(entry.crc32, 2962613731, 'crc checksum should be 2962613731');
  t.equal(
    entry.compressedSize,
    12,
    'compressed size should be same as size b/c no compression',
  );
  t.equal(entry.filenameLength, 9, 'filenameLength is correct');
  t.equal(entry.extraFieldLength, 0, 'entry have no extra fields');
  t.equal(entry.commentLength, 0, 'native file object dont have comments');
  t.equal(entry.diskNumberStart, 0, 'diskNumberStart is 0');
  t.equal(entry.internalFileAttributes, 0, 'internalFileAttributes is 0');
  t.equal(entry.externalFileAttributes, 0, 'externalFileAttributes is 0');
  t.equal(entry.directory, false, 'directory should be false');
  t.equal(entry.offset, 0, 'first entry starts at offset 0');
  t.equal(entry.zip64, false, 'small entries are not zip64');
  t.equal(entry.comment, '', 'helloWorld have no comments');
  t.equal(+entry.lastModifiedDate, date, 'time is the same');
  t.equal(entry.lastModified, date, 'entries should not store ms');
  t.equal(entry.name, 'Hello.txt', 'entry name should be Hello.txt');
  t.equal(entry.size, 12, 'entry size should be 12');
  t.equal(
    (await entry.arrayBuffer()).byteLength,
    12,
    'it can return an arrayBuffer',
  );
  t.equal(await entry.text(), 'Hello World\n', 'getting the text is accurate');

  // entry 2, The rest should be similar to entry 1 (test the differences is enough)
  entry = (await it.next()).value;
  t.equal(entry.name, '€15.txt', 'Name with utf8 chars works');
  t.equal(
    entry.comment,
    `I'm a entry comment with utf8`,
    `Entry should have a comment`,
  );
  t.equal(await entry.text(), '€15\n', 'Text should be the same');
  t.equal(entry.filenameLength, 9, '€ takes up 3 bytes');
  t.ok(entry.offset > 30, '2nd entry should not have the same offset as first');

  // entry 3, it can create folders
  entry = (await it.next()).value;
  t.equal(entry.directory, true, 'Entry should be a directory');
  t.equal(entry.name, 'folder/', 'Entry name should be folder/');

  t.end();
});

test('Writing - from custom stream', async (t) => {
  const { readable, writable } = new Writer();
  const inputChunks = [[1, 2, 3, 4], [5, 6, 7, 8]];

  const inputReadable = getInputReadable({ inputChunks })
  const writer = writeStuff(writable, inputReadable);

  const outputWritable = getOutputWritable();
  await readable.pipeTo(outputWritable);

  // Extract stored chunks off custom property on stream object
  let { outputChunks } = outputWritable;

  // Remove header and footer
  outputChunks = outputChunks.slice(1, inputChunks.length + 1);

  t.deepEqual(outputChunks, inputChunks);
});

test('Writing - abort input readable stream', async (t) => {
  const { readable, writable } = new Writer();

  const inputReadable = getInputReadable({ abort: true });
  const writer = writeStuff(writable, inputReadable);

  const outputWritable = getOutputWritable();

  try {
    await readable.pipeTo(outputWritable);
  } catch(error) {
    t.equals(error, ABORT_MESSAGE);
  }
});

test('Writing - cancel input readable stream', async (t) => {
  const { readable, writable } = new Writer();

  const inputReadable = getInputReadable();
  inputReadable.cancel(ABORT_MESSAGE);
  const writer = writeStuff(writable, inputReadable);

  const outputWritable = getOutputWritable();

  try {
    await readable.pipeTo(outputWritable);
  } catch(error) {
    const { cancelReason } = inputReadable;
    const { abortReason } = outputWritable;

    t.equals(error, ABORT_MESSAGE);
    t.equals(abortReason, ABORT_MESSAGE);
    t.equals(cancelReason, ABORT_MESSAGE);
  }
});

test('Writing - abort output writable stream', async (t) => {
  const { readable, writable } = new Writer();

  const inputReadable = getInputReadable();
  const writer = writeStuff(writable, inputReadable);

  const outputWritable = getOutputWritable({ long: true });

  try {
    const promise = readable.pipeTo(outputWritable);
    outputWritable.abort(ABORT_MESSAGE);
    await promise;
  } catch(error) {
    const { cancelReason } = inputReadable;
    const { abortReason } = outputWritable;

    t.equals(error, ABORT_MESSAGE);
    t.equals(abortReason, ABORT_MESSAGE);
    t.equals(cancelReason, ABORT_MESSAGE);
  }
});

test('Writing - early close output writable stream', async (t) => {
  const { readable, writable } = new Writer();

  const inputReadable = getInputReadable();
  const writer = writeStuff(writable, inputReadable);

  const outputWritable = getOutputWritable({ long: true });

  try {
    const promise = readable.pipeTo(outputWritable);
    outputWritable.close();
    await promise;
  } catch(error) {
    const { cancelReason } = inputReadable;
    const { abortReason } = outputWritable;

    t.equals(error, ABORT_MESSAGE);
    t.equals(abortReason, ABORT_MESSAGE);
    t.equals(cancelReason, ABORT_MESSAGE);
  }
});

test('Writing - error inoutput writable stream', async (t) => {
  const { readable, writable } = new Writer();

  const inputReadable = getInputReadable();
  const writer = writeStuff(writable, inputReadable);

  const outputWritable = getOutputWritable({ abort: true });

  try {
    const promise = readable.pipeTo(outputWritable);
    await promise;
  } catch(error) {
    const { cancelReason } = inputReadable;
    const { abortReason } = outputWritable;

    t.equals(error, ABORT_MESSAGE);
    // t.equals(abortReason, ABORT_MESSAGE);
    // t.equals(cancelReason, ABORT_MESSAGE);
  }
});



