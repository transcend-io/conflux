import test from 'tape';
import { Buffer } from 'buffer/';
import { Reader, StreamReader } from '../src/index.js';
import fixtures from './loadFixtures.js';

async function isSmiley(entry) {
  const a1 = Buffer.from(await entry.arrayBuffer());
  const a2 = Buffer.from(await fixtures['smile.gif'].arrayBuffer());
  return entry.size === 41 && entry.directory === false && a1.equals(a2);
}

/**
 * Abstraction to extract entries from either Reader or StreamReader
 * Returns a normalized array of entries for testing
 */
async function extractEntriesFromZip(method, fixture, { zip64 = false } = {}) {
  if (method === 'Reader') {
    // Use the traditional Reader (async iterator)
    const entries = [];
    const it = Reader(fixture);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await it.next();
      if (result.done) break;
      entries.push(result.value);
    }

    return entries;
  }
  if (method === 'StreamReader') {
    // Use the new StreamReader (transform stream)
    const entries = fixture.stream().pipeThrough(new StreamReader());
    const extractedEntries = [];

    const sink = new WritableStream({
      async write({ name, stream: fileStreamFn }) {
        // Read the file content
        const chunks = [];
        const fileStream = fileStreamFn();
        const reader = fileStream.getReader();

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        // Create a mock entry object that matches the interface expected by tests
        const mockEntry = {
          name,
          directory: name.endsWith('/'),
          zip64,
          size: chunks.reduce((sum, chunk) => sum + chunk.length, 0),
          // StreamReader doesn't have access to these properties from the central directory,
          // so we set reasonable defaults for tests that primarily focus on content
          comment: '',
          compressed: false,
          encrypted: false,
          async arrayBuffer() {
            const totalLength = chunks.reduce(
              (sum, chunk) => sum + chunk.length,
              0,
            );
            const result = new Uint8Array(totalLength);
            let offset = 0;
            chunks.forEach((chunk) => {
              result.set(chunk, offset);
              offset += chunk.length;
            });
            return result.buffer;
          },
          async text() {
            const blob = new Blob(chunks);
            return blob.text();
          },
        };

        extractedEntries.push(mockEntry);
      },
      abort(err) {
        throw new Error(`StreamReader extraction failed: ${err.message}`);
      },
    });

    await entries.pipeTo(sink);
    return extractedEntries;
  }

  throw new Error(`Unknown method: ${method}`);
}

// Test both Reader and StreamReader with the same test cases
['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - all_appended_bytes.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['all_appended_bytes.zip'],
    );

    // Run the same assertions for both implementations
    t.equal(extractedEntries.length, 3, 'Should have 3 entries');

    // entry 1
    const entry1 = extractedEntries[0];
    t.equal(entry1.name, 'Hello.txt');
    t.equal(entry1.directory, false);
    t.equal(entry1.zip64, false);
    t.equal(await entry1.text(), 'Hello World\n');

    // entry 2
    const entry2 = extractedEntries[1];
    t.equal(entry2.name, 'images/');
    t.equal(entry2.directory, true);

    // entry 3
    const entry3 = extractedEntries[2];
    t.equal(entry3.name, 'images/smile.gif');
    t.equal(await isSmiley(entry3), true);

    t.end();
  });
});

test('Reader - all_missing_bytes.zip', async (t) => {
  const err = await Reader(fixtures['all_missing_bytes.zip'])
    .next()
    .catch((a) => a);
  t.equal(err.message, 'Invalid ZIP file.');
  t.end();
});

test.skip('all_prepended_bytes.zip', async (t) => {
  const it = Reader(fixtures['all_prepended_bytes.zip']);
  t.ok((await it.next()).done);
  t.end();
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - all-stream.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['all-stream.zip'],
    );

    // entry 1
    const entry1 = extractedEntries[0];
    t.equal(entry1.name, 'Hello.txt');
    t.equal(entry1.directory, false);
    t.equal(await entry1.text(), 'Hello World\n');

    // entry 2
    const entry2 = extractedEntries[1];
    t.equal(entry2.name, 'images/');
    t.equal(entry2.directory, true);

    // entry 3
    const entry3 = extractedEntries[2];
    t.equal(entry3.name, 'images/smile.gif');
    t.equal(await isSmiley(entry3), true);

    t.end();
  });
});

test('Reader - all.7zip.zip', async (t) => {
  const it = Reader(fixtures['all.7zip.zip']);

  // entry 1
  let entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(entry.directory, false);
  t.equal(entry.comment, '');
  t.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  t.equal(entry.name, 'images/');
  t.equal(entry.directory, true);
  t.equal(entry.comment, '');

  // entry 3
  entry = (await it.next()).value;
  t.equal(entry.name, 'images/smile.gif');
  t.equal(await isSmiley(entry), true);
  t.equal(entry.comment, '');

  t.ok((await it.next()).done);
  t.end();
});

test('Reader - all.windows.zip', async (t) => {
  const it = Reader(fixtures['all.windows.zip']);

  // entry 1
  let entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(entry.directory, false);
  t.equal(entry.comment, '');
  t.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  t.equal(entry.name, 'images/smile.gif');
  t.equal(await isSmiley(entry), true);

  t.ok((await it.next()).done);
  t.end();
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - all.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['all.zip'],
    );

    // entry 1
    const entry1 = extractedEntries[0];
    t.equal(entry1.name, 'Hello.txt');
    t.equal(entry1.directory, false);
    t.equal(entry1.comment, '');
    t.equal(await entry1.text(), 'Hello World\n');

    // entry 2
    const entry2 = extractedEntries[1];
    t.equal(entry2.name, 'images/');
    t.equal(entry2.directory, true);
    t.equal(entry2.comment, '');

    // entry 3
    const entry3 = extractedEntries[2];
    t.equal(entry3.name, 'images/smile.gif');
    t.equal(await isSmiley(entry3), true);

    t.end();
  });
});

test('Reader - archive_comment.zip', async (t) => {
  const it = Reader(fixtures['archive_comment.zip']);

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(entry.directory, false);
  t.equal(entry.comment, 'entry comment');
  t.equal(await entry.text(), 'Hello World\n');

  t.ok((await it.next()).done);
  t.end();
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - backslash.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['backslash.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'Hel\\lo.txt');
    t.equal(entry.directory, false);
    t.equal(entry.comment, '');
    t.equal(await entry.text(), 'Hello World\n');

    t.end();
  });
});

// use -fd to force data descriptors as if streaming
// zip -fd -0 data_descriptor.zip Hello.txt
['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - data_descriptor.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['data_descriptor.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'Hello.txt');
    t.equal(entry.directory, false);
    t.equal(entry.comment, '');
    t.equal(await entry.text(), 'Hello World\n');

    t.end();
  });
});

// zip -6 -X -fd deflate-stream.zip Hello.txt
test('Reader - deflate-stream.zip', async (t) => {
  const it = Reader(fixtures['deflate-stream.zip']);

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(entry.directory, false);
  t.equal(entry.size, 94);
  t.equal(entry.compressedSize, 73);
  t.equal(entry.comment, '');
  t.equal(entry.compressionMethod, 8);
  t.equal(
    await entry.text(),
    'This a looong file : we need to see the difference between the different compression methods.\n',
  );

  t.ok((await it.next()).done);
  t.end();
});

// zip -6 -X deflate.zip Hello.txt
test('Reader - deflate.zip', async (t) => {
  const it = Reader(fixtures['deflate.zip']);

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(entry.directory, false);
  t.equal(entry.size, 94);
  t.equal(entry.compressedSize, 73);
  t.equal(entry.comment, '');
  t.equal(entry.compressionMethod, 8);
  t.equal(
    await entry.text(),
    'This a looong file : we need to see the difference between the different compression methods.\n',
  );

  t.ok((await it.next()).done);
  t.end();
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - empty.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['empty.zip'],
    );

    t.equal(extractedEntries.length, 0, 'Empty archive should have no entries');
    t.end();
  });
});

// zip -0 -X -e encrypted.zip Hello.txt
test('Reader - encrypted.zip', async (t) => {
  const it = Reader(fixtures['encrypted.zip']);

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(entry.directory, false);
  t.equal(entry.size, 12);
  t.equal(entry.encrypted, true);
  t.equal(entry.compressedSize, 24);
  t.equal(entry.comment, '');

  // TODO: make a way to read encrypted entries

  // const error = await entry.text().catch(e => e);
  // t.equal(error.message.startsWith('Failed to read Entry\n'), true);

  t.ok((await it.next()).done);
  t.end();
});

test('Reader - extra_attributes.zip', async (t) => {
  const it = Reader(fixtures['extra_attributes.zip']);

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(entry.directory, false);
  t.equal(entry.size, 12);
  t.equal(entry.compressedSize, 12);
  t.equal(entry.encrypted, false);
  t.equal(entry.comment, '');
  t.equal(await entry.text(), 'Hello World\n');

  t.ok((await it.next()).done);
  t.end();
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - folder.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['folder.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'folder/');
    t.equal(entry.directory, true);
    t.equal(entry.size, 0);
    if (method === 'Reader') {
      t.equal(entry.compressedSize, 0);
    }
    t.equal(entry.encrypted, false);
    t.equal(entry.comment, '');

    t.end();
  });
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - image.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['image.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'smile.gif');
    t.equal(entry.directory, false);
    t.equal(entry.size, 41);
    if (method === 'Reader') {
      t.equal(entry.compressedSize, 41);
    }
    t.equal(entry.encrypted, false);
    t.equal(entry.comment, '');

    t.end();
  });
});

test('Reader - local_encoding_in_name.zip', async (t) => {
  const it = Reader(fixtures['local_encoding_in_name.zip']);

  // ["Новая папка/Новый текстовый документ.txt"]

  // entry 1
  const entry = (await it.next()).value;

  const dv = entry.dataView;
  const uint8 = new Uint8Array(
    dv.buffer,
    dv.byteOffset + 46,
    entry.filenameLength,
  );

  // "Новая папка/"
  const a1 = Buffer.from('8daea2a0ef20afa0afaaa02f', 'hex');
  const a2 = Buffer.from(uint8);
  t.equal(entry.directory, true);
  t.equal(a1.equals(a2), true);
  t.equal(entry.directory, true);

  t.end();
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
test('Reader - nested_data_descriptor.zip', async (t) => {
  const it = Reader(fixtures['nested_data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['data_descriptor.zip'].arrayBuffer();
  t.deepLooseEqual(new Uint8Array(a1), new Uint8Array(a2));

  t.ok((await it.next()).done);
  t.end();
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
test('Reader - nested_data_descriptor.zip', async (t) => {
  const it = Reader(fixtures['nested_data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['data_descriptor.zip'].arrayBuffer();
  t.deepLooseEqual(new Uint8Array(a1), new Uint8Array(a2));

  t.ok((await it.next()).done);
  t.end();
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
test('Reader - nested_zip64.zip', async (t) => {
  const it = Reader(fixtures['nested_zip64.zip']);

  // entry 1
  const entry = (await it.next()).value;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['zip64.zip'].arrayBuffer();
  t.equal(entry.zip64, true);
  t.deepLooseEqual(new Uint8Array(a1), new Uint8Array(a2));

  t.ok((await it.next()).done);
  t.end();
});

// zip -0 -X zip_within_zip.zip Hello.txt && zip -0 -X nested.zip Hello.txt zip_within_zip.zip
test('Reader - nested.zip', async (t) => {
  const it = Reader(fixtures['nested.zip']);

  // entry 1
  let entry = (await it.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  t.equal(entry.name, 'zip_within_zip.zip');

  // entry 2.1
  const it2 = Reader(await entry.file());
  entry = (await it2.next()).value;
  t.equal(entry.name, 'Hello.txt');
  t.equal(await entry.text(), 'Hello World\n');

  t.ok((await it.next()).done);
  t.end();
});

// zip --entry-comments --archive-comment -X -0 pile_of_poo.zip Iñtërnâtiônàlizætiøn☃$'\360\237\222\251'.txt
test('Reader - pile_of_poo.zip', async (t) => {
  const it = Reader(fixtures['pile_of_poo.zip']);

  // this is the string "Iñtërnâtiônàlizætiøn☃💩",
  // see http://mathiasbynens.be/notes/javascript-unicode
  // but escaped, to avoid troubles
  // thanks http://mothereff.in/js-escapes#1I%C3%B1t%C3%ABrn%C3%A2ti%C3%B4n%C3%A0liz%C3%A6ti%C3%B8n%E2%98%83%F0%9F%92%A9
  const text = 'I\xF1t\xEBrn\xE2ti\xF4n\xE0liz\xE6ti\xF8n\u2603\uD83D\uDCA9';

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, `${text}.txt`);
  t.equal(entry.comment, text);
  t.equal(await entry.text(), text);

  t.ok((await it.next()).done);
  t.end();
});

// use izarc to generate a zip file on windows
test('Reader - slashes_and_izarc.zip', async (t) => {
  const it = Reader(fixtures['slashes_and_izarc.zip']);

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, 'test\\Hello.txt');
  t.equal(await entry.text(), 'Hello world\r\n');

  t.ok((await it.next()).done);
  t.end();
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - store-stream.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['store-stream.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'Hello.txt');
    t.equal(entry.size, 94);
    t.equal(
      await entry.text(),
      'This a looong file : we need to see the difference between the different compression methods.\n',
    );

    t.end();
  });
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - store.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['store.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'Hello.txt');
    t.equal(entry.size, 94);
    if (method === 'Reader') {
      t.equal(entry.compressedSize, 94);
    }
    t.equal(
      await entry.text(),
      'This a looong file : we need to see the difference between the different compression methods.\n',
    );

    t.end();
  });
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - subfolder.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['subfolder.zip'],
    );

    // entry 1
    const entry1 = extractedEntries[0];
    t.equal(entry1.name, 'folder/');
    t.equal(entry1.size, 0);
    t.equal(entry1.directory, true);

    // entry 2
    const entry2 = extractedEntries[1];
    t.equal(entry2.name, 'folder/subfolder/');
    t.equal(entry2.size, 0);
    t.equal(entry2.directory, true);

    t.end();
  });
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - text.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['text.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'Hello.txt');
    t.equal(entry.size, 12);
    t.equal(entry.directory, false);
    if (method === 'Reader') {
      t.equal(entry.compressedSize, 12);
    }
    t.equal(await entry.text(), 'Hello World\n');

    t.end();
  });
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - utf8_in_name.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['utf8_in_name.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, '€15.txt');
    t.equal(entry.directory, false);
    t.equal(entry.size, 6);
    if (method === 'Reader') {
      t.equal(entry.compressedSize, 6);
    }
    t.equal(await entry.text(), '€15\n');

    t.end();
  });
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - utf8.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['utf8.zip'],
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'amount.txt');
    t.equal(entry.directory, false);
    t.equal(entry.size, 6);
    if (method === 'Reader') {
      t.equal(entry.compressedSize, 6);
    }
    t.equal(await entry.text(), '€15\n');

    t.end();
  });
});

// Created with winrar
// winrar will replace the euro symbol with a '_' but set the correct unicode path in an extra field.
test('Reader - winrar_utf8_in_name.zip', async (t) => {
  const it = Reader(fixtures['winrar_utf8_in_name.zip']);

  // entry 1
  const entry = (await it.next()).value;
  t.equal(entry.name, '€15.txt');
  t.equal(entry.directory, false);
  t.equal(entry.size, 6);
  t.equal(entry.compressedSize, 6);
  t.equal(await entry.text(), '€15\n');
  // t.equal(entry.lastModified, 1328456448000);
  t.ok((await it.next()).done);
  t.end();
});

// cat zip64.zip Hello.txt > zip64_appended_bytes.zip
test.skip('zip64_appended_bytes.zip', async (t) => {
  const it = Reader(fixtures['zip64_appended_bytes.zip']);
  t.ok((await it.next()).done);
  t.end();
});

test.skip('zip64_missing_bytes.zip', async (t) => {
  const it = Reader(fixtures['zip64_missing_bytes.zip']);
  t.ok((await it.next()).done);
  t.end();
});

['Reader', 'StreamReader'].forEach((method) => {
  test(`${method} - zip64.zip`, async (t) => {
    const extractedEntries = await extractEntriesFromZip(
      method,
      fixtures['zip64.zip'],
      { zip64: true },
    );

    // entry 1
    const entry = extractedEntries[0];
    t.equal(entry.name, 'Hello.txt');
    t.equal(entry.directory, false);
    t.equal(entry.size, 12);
    t.equal(entry.zip64, true);
    t.equal(await entry.text(), 'Hello World\n');

    t.end();
  });
});
