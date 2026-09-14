/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable unicorn/no-await-expression-member */
import { assert } from '@esm-bundle/chai';
import { Reader } from '../src/index.js';
import type { Entry } from '../src/read.js';
import { fixtures } from './load-fixtures.js';

async function isSmiley(entry: Entry) {
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
it('Reading - all_appended_bytes.zip', async () => {
  const it = Reader(fixtures['all_appended_bytes.zip']);

  // entry 1
  let entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.zip64, false);
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);

  // entry 3
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
});

it('Reading - all_missing_bytes.zip', async () => {
  const result = await Reader(fixtures['all_missing_bytes.zip'])
    .next()
    .catch((error: unknown) => error as Error);
  assert.ok(result instanceof Error, 'error is an instance of Error');
  assert.equal(result.message, 'Invalid ZIP file.');
});

it.skip('all_prepended_bytes.zip', async () => {
  const it = Reader(fixtures['all_prepended_bytes.zip']);
  assert.ok((await it.next()).done);
});

it('Reading - all-stream.zip', async () => {
  const it = Reader(fixtures['all-stream.zip']);

  // entry 1
  let entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);

  // entry 3
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
});

it('Reading - all.7zip.zip', async () => {
  const it = Reader(fixtures['all.7zip.zip']);

  // entry 1
  let entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);
  assert.equal(entry.comment, '');

  // entry 3
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));
  assert.equal(entry.comment, '');

  assert.ok((await it.next()).done);
});

it('Reading - all.windows.zip', async () => {
  const it = Reader(fixtures['all.windows.zip']);

  // entry 1
  let entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
});

it('Reading - all.zip', async () => {
  const it = Reader(fixtures['all.zip']);

  // entry 1
  let entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/');
  assert.equal(entry.directory, true);
  assert.equal(entry.comment, '');

  // entry 3
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'images/smile.gif');
  assert.ok(await isSmiley(entry));

  assert.ok((await it.next()).done);
});

it('Reading - archive_comment.zip', async () => {
  const it = Reader(fixtures['archive_comment.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, 'entry comment');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
});

it('Reading - backslash.zip', async () => {
  const it = Reader(fixtures['backslash.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, String.raw`Hel\lo.txt`);
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
});

// use -fd to force data descriptors as if streaming
// zip -fd -0 data_descriptor.zip Hello.txt
it('Reading - data_descriptor.zip', async () => {
  const it = Reader(fixtures['data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
});

// zip -6 -X -fd deflate-stream.zip Hello.txt
it('Reading - deflate-stream.zip', async () => {
  const it = Reader(fixtures['deflate-stream.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
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
it('Reading - deflate.zip', async () => {
  const it = Reader(fixtures['deflate.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
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
it('Reading - empty.zip', async () => {
  const it = Reader(fixtures['empty.zip']);
  assert.ok((await it.next()).done);
});

// zip -0 -X -e encrypted.zip Hello.txt
it('Reading - encrypted.zip', async () => {
  const it = Reader(fixtures['encrypted.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
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

it('Reading - extra_attributes.zip', async () => {
  const it = Reader(fixtures['extra_attributes.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 12);
  assert.equal(entry.compressedSize, 12);
  assert.equal(entry.encrypted, false);
  assert.equal(entry.comment, '');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
});

it('Reading - folder.zip', async () => {
  const it = Reader(fixtures['folder.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'folder/');
  assert.equal(entry.directory, true);
  assert.equal(entry.size, 0);
  assert.equal(entry.compressedSize, 0);
  assert.equal(entry.encrypted, false);
  assert.equal(entry.comment, '');

  assert.ok((await it.next()).done);
});

it('Reading - image.zip', async () => {
  const it = Reader(fixtures['image.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'smile.gif');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 41);
  assert.equal(entry.compressedSize, 41);
  assert.equal(entry.encrypted, false);
  assert.equal(entry.comment, '');

  assert.ok((await it.next()).done);
});

it('Reading - local_encoding_in_name.zip', async () => {
  const it = Reader(fixtures['local_encoding_in_name.zip']);

  // ["Новая папка/Новый текстовый документ.txt"]

  // entry 1
  const entry = (await it.next()).value as Entry;

  const dv = entry.dataView;
  const uint8 = new Uint8Array(
    dv.buffer,
    dv.byteOffset + 46,
    entry.filenameLength,
  );

  // "Новая папка/"
  const a1 = new Uint8Array(
    '8daea2a0ef20afa0afaaa02f'.match(/../g)!.map((h) => Number.parseInt(h, 16)),
  );
  const a2 = new Uint8Array(uint8);
  assert.equal(entry.directory, true);
  assert.deepStrictEqual(a1, a2);
  assert.equal(entry.directory, true);
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
it('Reading - nested_data_descriptor.zip', async () => {
  const it = Reader(fixtures['nested_data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['data_descriptor.zip'].arrayBuffer();
  assert.deepStrictEqual(new Uint8Array(a1), new Uint8Array(a2));

  assert.ok((await it.next()).done);
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
it('Reading - nested_data_descriptor.zip', async () => {
  const it = Reader(fixtures['nested_data_descriptor.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['data_descriptor.zip'].arrayBuffer();
  assert.deepStrictEqual(new Uint8Array(a1), new Uint8Array(a2));

  assert.ok((await it.next()).done);
});

// zip -fd -0 nested_data_descriptor.zip data_descriptor.zip
it('Reading - nested_zip64.zip', async () => {
  const it = Reader(fixtures['nested_zip64.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  const a1 = await entry.arrayBuffer();
  const a2 = await fixtures['zip64.zip'].arrayBuffer();
  assert.equal(entry.zip64, true);
  assert.deepStrictEqual(new Uint8Array(a1), new Uint8Array(a2));

  assert.ok((await it.next()).done);
});

// zip -0 -X zip_within_zip.zip Hello.txt && zip -0 -X nested.zip Hello.txt zip_within_zip.zip
it('Reading - nested.zip', async () => {
  const it = Reader(fixtures['nested.zip']);

  // entry 1
  let entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(await entry.text(), 'Hello World\n');

  // entry 2
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'zip_within_zip.zip');

  // entry 2.1
  const it2 = Reader(await entry.file());
  entry = (await it2.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
});

// zip --entry-comments --archive-comment -X -0 pile_of_poo.zip Iñtërnâtiônàlizætiøn☃$'\360\237\222\251'.txt
it('Reading - pile_of_poo.zip', async () => {
  const it = Reader(fixtures['pile_of_poo.zip']);

  // this is the string "Iñtërnâtiônàlizætiøn☃💩",
  // see http://mathiasbynens.be/notes/javascript-unicode
  // but escaped, to avoid troubles
  // thanks http://mothereff.in/js-escapes#1I%C3%B1t%C3%ABrn%C3%A2ti%C3%B4n%C3%A0liz%C3%A6ti%C3%B8n%E2%98%83%F0%9F%92%A9
  const text =
    'I\u00F1t\u00EBrn\u00E2ti\u00F4n\u00E0liz\u00E6ti\u00F8n\u2603\uD83D\uDCA9';

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, `${text}.txt`);
  assert.equal(entry.comment, text);
  assert.equal(await entry.text(), text);

  assert.ok((await it.next()).done);
});

// use izarc to generate a zip file on windows
it('Reading - slashes_and_izarc.zip', async () => {
  const it = Reader(fixtures['slashes_and_izarc.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, String.raw`test\Hello.txt`);
  assert.equal(await entry.text(), 'Hello world\r\n');

  assert.ok((await it.next()).done);
});

// zip -0 -X -fd store-stream.zip Hello.txt
it('Reading - store-stream.zip', async () => {
  const it = Reader(fixtures['store-stream.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
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
it('Reading - store.zip', async () => {
  const it = Reader(fixtures['store.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.size, 94);
  assert.equal(entry.compressedSize, 94);
  assert.equal(
    await entry.text(),
    'This a looong file : we need to see the difference between the different compression methods.\n',
  );

  assert.ok((await it.next()).done);
});

it('Reading - subfolder.zip', async () => {
  const it = Reader(fixtures['subfolder.zip']);

  // entry 1
  let entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'folder/');
  assert.equal(entry.size, 0);
  assert.equal(entry.compressedSize, 0);
  assert.equal(entry.directory, true);

  // // entry 2
  entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'folder/subfolder/');
  assert.equal(entry.size, 0);
  assert.equal(entry.compressedSize, 0);
  assert.equal(entry.directory, true);

  assert.ok((await it.next()).done);
});

it('Reading - text.zip', async () => {
  const it = Reader(fixtures['text.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.size, 12);
  assert.equal(entry.directory, false);
  assert.equal(entry.compressedSize, 12);
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
});

// zip -X -0 utf8_in_name.zip €15.txt
it('Reading - utf8_in_name.zip', async () => {
  const it = Reader(fixtures['utf8_in_name.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, '€15.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 6);
  assert.equal(entry.compressedSize, 6);
  assert.equal(await entry.text(), '€15\n');

  assert.ok((await it.next()).done);
});

// zip -X -0 utf8.zip amount.txt
it('Reading - utf8.zip', async () => {
  const it = Reader(fixtures['utf8.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'amount.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 6);
  assert.equal(entry.compressedSize, 6);
  assert.equal(await entry.text(), '€15\n');

  assert.ok((await it.next()).done);
});

// Created with winrar
// winrar will replace the euro symbol with a '_' but set the correct unicode path in an extra field.
it('Reading - winrar_utf8_in_name.zip', async () => {
  const it = Reader(fixtures['winrar_utf8_in_name.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, '€15.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 6);
  assert.equal(entry.compressedSize, 6);
  assert.equal(await entry.text(), '€15\n');
  // assert.equal(entry.lastModified, 1328456448000);
  assert.ok((await it.next()).done);
});

// cat zip64.zip Hello.txt > zip64_appended_bytes.zip
it.skip('zip64_appended_bytes.zip', async () => {
  const it = Reader(fixtures['zip64_appended_bytes.zip']);
  assert.ok((await it.next()).done);
});

it.skip('zip64_missing_bytes.zip', async () => {
  const it = Reader(fixtures['zip64_missing_bytes.zip']);
  assert.ok((await it.next()).done);
});

it('Reading - zip64.zip', async () => {
  const it = Reader(fixtures['zip64.zip']);

  // entry 1
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'Hello.txt');
  assert.equal(entry.directory, false);
  assert.equal(entry.size, 12);
  assert.equal(entry.zip64, true);
  assert.equal(await entry.text(), 'Hello World\n');

  assert.ok((await it.next()).done);
});

/**
 * Build a classic (non-Zip64) stored archive of `count` empty entries by hand.
 * With 0xFFFF entries the end of central directory count field equals the
 * Zip64 sentinel even though no Zip64 records exist, which is what e.g.
 * Python's zipfile produces for exactly 65,535 entries.
 */
function classicArchive(count: number): Blob {
  const encoder = new TextEncoder();
  const names = Array.from({ length: count }, (_, index) =>
    encoder.encode(String(index)),
  );
  const localLength = names.reduce(
    (total, name) => total + 30 + name.length,
    0,
  );
  const centralLength = names.reduce(
    (total, name) => total + 46 + name.length,
    0,
  );
  const bytes = new Uint8Array(localLength + centralLength + 22);
  const dv = new DataView(bytes.buffer);

  let local = 0;
  let central = localLength;
  for (const name of names) {
    dv.setUint32(local, 0x50_4b_03_04);
    dv.setUint16(local + 4, 20, true);
    dv.setUint16(local + 26, name.length, true);
    bytes.set(name, local + 30);

    dv.setUint32(central, 0x50_4b_01_02);
    dv.setUint16(central + 4, 20, true);
    dv.setUint16(central + 6, 20, true);
    dv.setUint16(central + 28, name.length, true);
    dv.setUint32(central + 42, local, true);
    bytes.set(name, central + 46);

    local += 30 + name.length;
    central += 46 + name.length;
  }

  dv.setUint32(central, 0x50_4b_05_06);
  dv.setUint16(central + 8, Math.min(count, 0xff_ff), true);
  dv.setUint16(central + 10, Math.min(count, 0xff_ff), true);
  dv.setUint32(central + 12, centralLength, true);
  dv.setUint32(central + 16, localLength, true);
  return new Blob([bytes]);
}

it('Reading - classic archive with exactly 0xFFFF entries and no Zip64 records', async () => {
  const count = 0xff_ff;
  let read = 0;
  let last: Entry | undefined;
  for await (const entry of Reader(classicArchive(count))) {
    if (read === 0) {
      assert.equal(entry.name, '0');
      assert.equal(entry.offset, 0);
    }
    last = entry;
    read++;
  }
  assert.equal(read, count, 'all entries are read from the classic fields');
  assert.equal(last?.name, String(count - 1));
  assert.equal(last?.zip64, false);
});

/**
 * Build a one-entry stored archive with optional Zip64 records and comments.
 * This keeps Zip64 parser edge-case fixtures small and explicit.
 */
function singleEntryArchive({
  compressedSize = 0,
  uncompressedSize = 0,
  extra = new Uint8Array(0),
  entryComment = new Uint8Array(0),
  archiveComment = new Uint8Array(0),
  zip64 = false,
}: {
  compressedSize?: number;
  uncompressedSize?: number;
  extra?: Uint8Array;
  entryComment?: Uint8Array;
  archiveComment?: Uint8Array;
  zip64?: boolean;
}): Blob {
  const name = new TextEncoder().encode('x');
  const localLength = 30 + name.length;
  const centralLength = 46 + name.length + extra.length + entryComment.length;
  const trailerLength = (zip64 ? 56 + 20 : 0) + 22;
  const bytes = new Uint8Array(
    localLength + centralLength + trailerLength + archiveComment.length,
  );
  const dv = new DataView(bytes.buffer);

  // Local file header for an empty stored entry.
  dv.setUint32(0, 0x50_4b_03_04);
  dv.setUint16(4, zip64 ? 45 : 20, true);
  dv.setUint16(26, name.length, true);
  bytes.set(name, 30);

  // Central directory record.
  const central = localLength;
  dv.setUint32(central, 0x50_4b_01_02);
  dv.setUint16(central + 4, zip64 ? 45 : 20, true);
  dv.setUint16(central + 6, zip64 ? 45 : 20, true);
  dv.setUint32(central + 20, compressedSize, true);
  dv.setUint32(central + 24, uncompressedSize, true);
  dv.setUint16(central + 28, name.length, true);
  dv.setUint16(central + 30, extra.length, true);
  dv.setUint16(central + 32, entryComment.length, true);
  bytes.set(name, central + 46);
  bytes.set(extra, central + 46 + name.length);
  bytes.set(entryComment, central + 46 + name.length + extra.length);

  let eocd = central + centralLength;
  if (zip64) {
    // Zip64 end of central directory record.
    dv.setUint32(eocd, 0x50_4b_06_06);
    dv.setBigUint64(eocd + 4, BigInt(44), true);
    dv.setUint16(eocd + 12, 45, true);
    dv.setUint16(eocd + 14, 45, true);
    dv.setBigUint64(eocd + 24, BigInt(1), true);
    dv.setBigUint64(eocd + 32, BigInt(1), true);
    dv.setBigUint64(eocd + 40, BigInt(centralLength), true);
    dv.setBigUint64(eocd + 48, BigInt(central), true);

    // Zip64 end of central directory locator.
    const locator = eocd + 56;
    dv.setUint32(locator, 0x50_4b_06_07);
    dv.setBigUint64(locator + 8, BigInt(eocd), true);
    dv.setUint32(locator + 16, 1, true);
    eocd = locator + 20;
  }

  // Classic end of central directory record. Force sentinels for the Zip64
  // fixture so the Reader must follow the locator.
  dv.setUint32(eocd, 0x50_4b_05_06);
  dv.setUint16(eocd + 8, zip64 ? 0xff_ff : 1, true);
  dv.setUint16(eocd + 10, zip64 ? 0xff_ff : 1, true);
  dv.setUint32(eocd + 12, zip64 ? 0xff_ff_ff_ff : centralLength, true);
  dv.setUint32(eocd + 16, zip64 ? 0xff_ff_ff_ff : central, true);
  dv.setUint16(eocd + 20, archiveComment.length, true);
  bytes.set(archiveComment, eocd + 22);

  return new Blob([bytes]);
}

it('Reading - Zip64 archive with an archive comment', async () => {
  const archiveComment = new TextEncoder().encode('archive comment');
  const it = Reader(singleEntryArchive({ archiveComment, zip64: true }));

  const entry = (await it.next()).value as Entry;
  assert.equal(entry.name, 'x');
  assert.equal(entry.offset, 0);
  assert.equal(entry.size, 0);
  assert.ok((await it.next()).done);
});

it('Reading - Zip64 values are unsigned', async () => {
  const value = BigInt('0x8000000000000001');
  const extra = new Uint8Array(20);
  const dv = new DataView(extra.buffer);
  dv.setUint16(0, 0x00_01, true);
  dv.setUint16(2, 16, true);
  dv.setBigUint64(4, value, true);
  dv.setBigUint64(12, value, true);

  const it = Reader(
    singleEntryArchive({
      compressedSize: 0xff_ff_ff_ff,
      uncompressedSize: 0xff_ff_ff_ff,
      extra,
    }),
  );
  const entry = (await it.next()).value as Entry;
  assert.equal(entry.size, value);
  assert.equal(entry.compressedSize, Number(value));
});

it('Reading - rejects an extra field whose payload exceeds the extra area', async () => {
  const extra = new Uint8Array(4);
  const extraView = new DataView(extra.buffer);
  extraView.setUint16(0, 0x00_01, true);
  extraView.setUint16(2, 8, true);

  const entryComment = new Uint8Array(8);
  new DataView(entryComment.buffer).setBigUint64(0, BigInt(123), true);
  const result = await Reader(
    singleEntryArchive({
      uncompressedSize: 0xff_ff_ff_ff,
      extra,
      entryComment,
    }),
  )
    .next()
    .catch((error: unknown) => error as Error);

  assert.ok(result instanceof Error);
  assert.equal(result.message, 'Invalid ZIP file.');
});
