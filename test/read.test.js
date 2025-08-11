import { assert } from '@esm-bundle/chai';
// import { Buffer } from 'buffer/';
import { Reader } from '../src/index.js';
import fixtures from './loadFixtures.js';

async function isSmiley(entry) {
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['smile.gif'].arrayBuffer();
  assert.equal(entry.size, 41);
  assert.equal(a1.byteLength, 41);
  assert.equal(a2.byteLength, 41);
  assert.isFalse(entry.directory);
  assert.deepStrictEqual(a1, a2);
  return true;
}

// All test are orderd by filename
test('Reading - all_appended_bytes.zip', async () => {
  const it = Reader(fixtures['all_appended_bytes.zip']);

  // entry 1
  let entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.zip64, false);
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);

  // entry 3
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
  
});

test('Reading - all_missing_bytes.zip', async () => {
  const err = await Reader(fixtures['all_missing_bytes.zip'])
    .next()
    .catch((a) => a);
  assert.equal(err.message, 'Invalid ZIP file.');
  
});

test.skip('all_prepended_bytes.zip', async () => {
  const it = Reader(fixtures['all_prepended_bytes.zip']);
  assert.ok((await it.next()).done);
  
});

test('Reading - all-stream.zip', async () => {
  const it = Reader(fixtures['all-stream.zip']);

  // entry 1
  let entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);

  // entry 3
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
  
});

test('Reading - all.7zip.zip', async () => {
  const it = Reader(fixtures['all.7zip.zip']);

  // entry 1
  let entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);
  assert.equal(entry.comment, '');

  // entry 3
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));
  assert.equal(entry.comment, '');

  assert.ok((await it.next()).done);
  
});

test('Reading - all.windows.zip', async () => {
  const it = Reader(fixtures['all.windows.zip']);

  // entry 1
  let entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
  
});

test('Reading - all.zip', async () => {
  const it = Reader(fixtures['all.zip']);

  // entry 1
  let entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);
  assert.equal(entry.comment, '');

  // entry 3
  entry = (await it.next()).value;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
  
});

test('Reading - archive_comment.zip', async () => {
  const it = Reader(fixtures['archive_comment.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, 'entry comment');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
  
});

test('Reading - backslash.zip', async () => {
  const it = Reader(fixtures['backslash.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hel\\lo.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
  
});

// use -fd to force data descriptors as if streaming
// zip -fd -0 data_descriptor.zip Hello.txt
test('Reading - data_descriptor.zip', async () => {
  const it = Reader(fixtures['data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
  
});

// zip -6 -X -fd deflate-stream.zip Hello.txt
test('Reading - deflate-stream.zip', async () => {
  const it = Reader(fixtures['deflate-stream.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 94);
  assert.equal(entry.compressedSize, 73);
  assert.equal(entry.comment, '');
  assert.equal(entry.compressionMethod, 8);
  assert.equal(
    await entry.text(),
    'This a looong file : we need to see the difference between the different compression methods.\n',
  );

  assert.ok((await it.next()).done);
  
});

// zip -6 -X deflate.zip Hello.txt
test('Reading - deflate.zip', async () => {
  const it = Reader(fixtures['deflate.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 94);
  assert.equal(entry.compressedSize, 73);
  assert.equal(entry.comment, '');
  assert.equal(entry.compressionMethod, 8);
  assert.equal(
    await entry.text(),
    'This a looong file : we need to see the difference between the different compression methods.\n',
  );

  assert.ok((await it.next()).done);
  
});

// zip -0 -X empty.zip plop && zip -d empty.zip plop
test('Reading - empty.zip', async () => {
  const it = Reader(fixtures['empty.zip']);
  assert.ok((await it.next()).done);
  
});

// zip -0 -X -e encrypted.zip Hello.txt
test('Reading - encrypted.zip', async () => {
  const it = Reader(fixtures['encrypted.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 12);
  assert.equal(entry.encrypted, true);
  assert.equal(entry.compressedSize, 24);
  assert.equal(entry.comment, '');

  // TODO: make a way to read encrypted entries

  // const error = await entry.text().catch(e => e);
  // assert.equal(error.message.startsWith('Failed to read Entry\n'), true);

  assert.ok((await it.next()).done);
  
});

test('Reading - extra_attributes.zip', async () => {
  const it = Reader(fixtures['extra_attributes.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 12);
  assert.equal(entry.compressedSize, 12);
  assert.equal(entry.encrypted, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
  
});

test('Reading - folder.zip', async () => {
  const it = Reader(fixtures['folder.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'folder/');
  assert.equal(entry.directory, true);
  assert.equal(entry.size, 0);
  assert.equal(entry.compressedSize, 0);
  assert.equal(entry.encrypted, false);
  assert.equal(entry.comment, '');

  assert.ok((await it.next()).done);
  
});

test('Reading - image.zip', async () => {
  const it = Reader(fixtures['image.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'smile.gif');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 41);
  assert.equal(entry.compressedSize, 41);
  assert.equal(entry.encrypted, false);
  assert.equal(entry.comment, '');

  assert.ok((await it.next()).done);
  
});

test('Reading - local_encoding_in_name.zip', async () => {
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
  assert.equal(entry.directory, true);
  assert.equal(a1.equals(a2), true);
  assert.equal(entry.directory, true);

  
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
test('Reading - nested_data_descriptor.zip', async () => {
  const it = Reader(fixtures['nested_data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['data_descriptor.zip'].arrayBuffer();
  t.deepLooseEqual(new Uint8Array(a1), new Uint8Array(a2));

  assert.ok((await it.next()).done);
  
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
test('Reading - nested_data_descriptor.zip', async () => {
  const it = Reader(fixtures['nested_data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['data_descriptor.zip'].arrayBuffer();
  t.deepLooseEqual(new Uint8Array(a1), new Uint8Array(a2));

  assert.ok((await it.next()).done);
  
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
test('Reading - nested_zip64.zip', async () => {
  const it = Reader(fixtures['nested_zip64.zip']);

  // entry 1
  const entry = (await it.next()).value;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['zip64.zip'].arrayBuffer();
  assert.equal(entry.zip64, true);
  t.deepLooseEqual(new Uint8Array(a1), new Uint8Array(a2));

  assert.ok((await it.next()).done);
  
});

// zip -0 -X zip_within_zip.zip Hello.txt && zip -0 -X nested.zip Hello.txt zip_within_zip.zip
test('Reading - nested.zip', async () => {
  const it = Reader(fixtures['nested.zip']);

  // entry 1
  let entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value;
  assert.equal(entry.name, 'zip_within_zip.zip');

  // entry 2.1
  const it2 = Reader(await entry.file());
  entry = (await it2.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
  
});

// zip --entry-comments --archive-comment -X -0 pile_of_poo.zip Iñtërnâtiônàlizætiøn☃$'\360\237\222\251'.txt
test('Reading - pile_of_poo.zip', async () => {
  const it = Reader(fixtures['pile_of_poo.zip']);

  // this is the string "Iñtërnâtiônàlizætiøn☃💩",
  // see http://mathiasbynens.be/notes/javascript-unicode
  // but escaped, to avoid troubles
  // thanks http://mothereff.in/js-escapes#1I%C3%B1t%C3%ABrn%C3%A2ti%C3%B4n%C3%A0liz%C3%A6ti%C3%B8n%E2%98%83%F0%9F%92%A9
  const text = 'I\xF1t\xEBrn\xE2ti\xF4n\xE0liz\xE6ti\xF8n\u2603\uD83D\uDCA9';

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, `${text}.txt`);
  assert.equal(entry.comment, text);
  assert.equal(await entry.text(), text);

  assert.ok((await it.next()).done);
  
});

// use izarc to generate a zip file on windows
test('Reading - slashes_and_izarc.zip', async () => {
  const it = Reader(fixtures['slashes_and_izarc.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'test\\Hello.txt');
  assert.equal(await entry.text(), 'Hello world\r\n');

  assert.ok((await it.next()).done);
  
});

// zip -0 -X -fd store-stream.zip Hello.txt
test('Reading - store-stream.zip', async () => {
  const it = Reader(fixtures['store-stream.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.size, 94);
  assert.equal(entry.compressedSize, 94);
  assert.equal(
    await entry.text(),
    'This a looong file : we need to see the difference between the different compression methods.\n',
  );

  assert.ok((await it.next()).done);
  
});

// zip -0 -X store.zip Hello.txt
test('Reading - store.zip', async () => {
  const it = Reader(fixtures['store.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.size, 94);
  assert.equal(entry.compressedSize, 94);
  assert.equal(
    await entry.text(),
    'This a looong file : we need to see the difference between the different compression methods.\n',
  );

  assert.ok((await it.next()).done);
  
});

test('Reading - subfolder.zip', async () => {
  const it = Reader(fixtures['subfolder.zip']);

  // entry 1
  let entry = (await it.next()).value;
  assert.equal(entry.name, 'folder/');
  assert.equal(entry.size, 0);
  assert.equal(entry.compressedSize, 0);
  assert.equal(entry.directory, true);

  // // entry 2
  entry = (await it.next()).value;
  assert.equal(entry.name, 'folder/subfolder/');
  assert.equal(entry.size, 0);
  assert.equal(entry.compressedSize, 0);
  assert.equal(entry.directory, true);

  assert.ok((await it.next()).done);
  
});

test('Reading - text.zip', async () => {
  const it = Reader(fixtures['text.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.size, 12);
  assert.equal(entry.directory, false);
  assert.equal(entry.compressedSize, 12);
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
  
});

// zip -X -0 utf8_in_name.zip €15.txt
test('Reading - utf8_in_name.zip', async () => {
  const it = Reader(fixtures['utf8_in_name.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, '€15.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 6);
  assert.equal(entry.compressedSize, 6);
  assert.equal(await entry.text(), '€15\n');

  assert.ok((await it.next()).done);
  
});

// zip -X -0 utf8.zip amount.txt
test('Reading - utf8.zip', async () => {
  const it = Reader(fixtures['utf8.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'amount.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 6);
  assert.equal(entry.compressedSize, 6);
  assert.equal(await entry.text(), '€15\n');

  assert.ok((await it.next()).done);
  
});

// Created with winrar
// winrar will replace the euro symbol with a '_' but set the correct unicode path in an extra field.
test('Reading - winrar_utf8_in_name.zip', async () => {
  const it = Reader(fixtures['winrar_utf8_in_name.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, '€15.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 6);
  assert.equal(entry.compressedSize, 6);
  assert.equal(await entry.text(), '€15\n');
  // assert.equal(entry.lastModified, 1328456448000);
  assert.ok((await it.next()).done);
  
});

// cat zip64.zip Hello.txt > zip64_appended_bytes.zip
test.skip('zip64_appended_bytes.zip', async () => {
  const it = Reader(fixtures['zip64_appended_bytes.zip']);
  assert.ok((await it.next()).done);
  
});

test.skip('zip64_missing_bytes.zip', async () => {
  const it = Reader(fixtures['zip64_missing_bytes.zip']);
  assert.ok((await it.next()).done);
  
});

test('Reading - zip64.zip', async () => {
  const it = Reader(fixtures['zip64.zip']);

  // entry 1
  const entry = (await it.next()).value;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 12);
  assert.equal(entry.zip64, true);
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
  
});
