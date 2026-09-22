# Conflux

Build and read zip files with whatwg streams in the browser.

<p>
  <a href="https://snyk.io//test/github/transcend-io/conflux?targetFile=package.json"><img src="https://snyk.io//test/github/transcend-io/conflux/badge.svg?targetFile=package.json" alt="Known Vulnerabilities"></a>
  <a href="https://app.fossa.io/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux?ref=badge_shield" alt="FOSSA Status"><img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux.svg?type=shield"/></a>
</p>

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Blazing Fast](#blazing-fast)
- [Compatibility](#compatibility)
- [Examples](#examples)
- [Usage](#usage)
  - [Importing Conflux](#importing-conflux)
  - [Creating a ZIP](#creating-a-zip)
  - [Reading ZIP files](#reading-zip-files)
- [Supporting Legacy Browsers](#supporting-legacy-browsers)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Blazing Fast

- ~55 kB import
- Uses streams, minimizing memory overhead

## Compatibility

|         |     |
| ------- | --: |
| Chrome  |  ✅ |
| Safari  |  ✅ |
| Edge    |  ✅ |
| Firefox |  ✅ |

## Examples

- [Writing zips](https://codesandbox.io/s/transcend-ioconflux-writing-x8vq4?file=/src/index.js)
- [Reading zips](https://codesandbox.io/s/transcend-ioconflux-reading-rzl9l?file=/src/index.js)

## Usage

### Importing Conflux

```sh
npm install --save @transcend-io/conflux
```

```js
// Reader parses zip files, Writer builds zip files
import { Reader, Writer } from '@transcend-io/conflux';
```

### Creating a ZIP

#### Example using `ReadableStream#pipeThrough`

```js
import { Writer } from '@transcend-io/conflux';
import streamSaver from 'streamsaver';

const s3 = 'https://s3-us-west-2.amazonaws.com/your-bucket/';
const files = ['NYT.txt', 'water.png', 'Earth.jpg'].values();

const myReadable = new ReadableStream({
  async pull(controller) {
    const { done, value } = files.next();
    if (done) return controller.close();
    const { body } = await fetch(s3 + value);
    return controller.enqueue({
      name: `/${value}`,
      stream: () => body,
    });
  },
});

myReadable
  .pipeThrough(new Writer())
  .pipeTo(streamSaver.createWriteStream('conflux.zip'));

// optionally, you can pass in a [queueing strategy](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream/TransformStream#writablestrategy)
// to the constructure in order to specify the number of streams being consumed at a time
// default queue size is one, meaning only a single stream will be processed at a time
myReadable
  .pipeThrough(
    new Writer({
      // Write stream will allow 5 chunks in the underlying queue.
      // Once the entry's stream returns `done`, a new entry will be pulled
      // from `myReadable`.
      highWaterMark: 5,
      // each "chunk" in the queue represents 1 out of the total 5 we set for our limit
      size: (_: ZipTransformerEntry) => 1,
   }))
  .pipeTo(streamSaver.createWriteStream('conflux.zip'));
```

#### Example using `writer.write`

```js
import { Writer } from '@transcend-io/conflux';

import streamSaver from 'streamsaver';

// Set up conflux
const { readable, writable } = new Writer();
const writer = writable.getWriter();

// Set up streamsaver
const fileStream = streamSaver.createWriteStream('conflux.zip');

// Add a file
writer.write({
  name: '/cat.txt',
  lastModified: new Date(0),
  stream: () => new Response('mjau').body,
});

readable.pipeTo(fileStream);

writer.close();
```

#### Incorporating other streams

```js
import { Writer } from '@transcend-io/conflux';
import streamSaver from 'streamsaver';

const { readable, writable } = new Writer();
const writer = writable.getWriter();
const reader = readable.getReader();

// Set up streamsaver
const fileStream = streamSaver.createWriteStream('conflux.zip');

(async () => {
  writer.write({
    name: '/cat.txt',
    lastModified: new Date(0),
    stream: () => new Response('mjau').body,
  });

  const imgStream = await fetch(
    'https://s3-us-west-2.amazonaws.com/your-bucket/Earth.jpg',
  ).then((r) => r.body);

  writer.write({
    name: '/Earth.jpg',
    lastModified: new Date(0),
    stream: () => imgStream,
  });

  readable.pipeTo(fileStream);

  writer.close();
})();
```

#### Large archives (Zip64)

Archives over 4 GB, entries over 4 GB, and archives with 65,535 or more entries are written with [Zip64](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT) extensions: Zip64 extra fields in the central directory for any size or offset that overflows 32 bits, and a Zip64 end of central directory record plus locator when needed. Smaller archives keep a classic central directory and end of central directory record.

Because the writer streams, it does not know an entry's size until the data has been written. It therefore uses the same layout Info-ZIP `zip` and Python `zipfile` produce for unseekable output: every local header declares `version needed to extract` 4.5, carries a Zip64 extra field with zero placeholder sizes, and is followed by a 64-bit (24-byte) data descriptor holding the real CRC and sizes. This lets both central-directory readers (Windows Explorer, macOS Archive Utility, Info-ZIP `unzip`, 7-Zip, Python `zipfile`, Java `ZipFile`, this library's `Reader`) and forward-only streaming readers (libarchive `bsdtar` on a pipe) parse the output, at a cost of 28 bytes per entry.

One consumer class is not supported: **Office document containers** (OOXML / ODF). Microsoft Office and LibreOffice require `version needed to extract` 2.0 for package parts and reject a `.docx`/`.xlsx`/`.ods` assembled with this writer. Use a non-streaming ZIP library for those.

##### Verifying large archives

Browser tests cannot hand a multi-gigabyte file to external tools, so the Zip64 path is checked in three layers:

1. **Unit tests** (`pnpm test`) cover the record builders at the boundaries (`0xFFFFFFFF`, 4 GiB + 1, 65,535 entries) and round-trip a small entry seeded past the 4 GiB offset through the `Reader`.
2. **Opt-in streaming tests** (`FF_BIG_FIXTURES=run pnpm test`, Chromium, ~6 minutes) push real 4 GiB+ streams through the `Writer` while discarding payload bytes, then parse the sparse result with the `Reader`.
3. **On-disk fixtures against external readers.** Run the built `Writer` under Node (`globalThis.self = globalThis` before importing `dist/esm/index.js`, since the library probes `self`), pipe `Readable.fromWeb(writer.readable)` into a file, and record a SHA-256 per entry while generating unique-per-chunk data. Useful shapes: five 1 GiB entries plus a small one (offsets overflow, sizes do not), one 4.4 GB entry plus a small one (sizes overflow and the trailing offset overflows), and a few-KB archive. Then run each fixture through:
   - `unzip -t` and `zipinfo -v` (Info-ZIP): confirms CRCs and shows the Zip64 extra fields and offsets.
   - `7z t` then `7z x` and compare every extracted file against the recorded SHA-256.
   - `python3 -c 'import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).testzip())' fixture.zip`.
   - `bsdtar -tvf fixture.zip` (seekable) and `cat fixture.zip | bsdtar -xOf - > /dev/null` (forward-only streaming, no central directory access).
   - Finally open the >4 GB fixtures in Windows Explorer and macOS Archive Utility, the targets that cannot be scripted from Linux.

#### Resuming an interrupted archive

The writer can continue an archive whose leading bytes are already on disk, so a long download does not have to start over after a failure. Pass `onEntryComplete` to receive a checkpoint after each entry's data descriptor (offsets and sizes are `bigint`, structured-clone friendly for IndexedDB), and later seed a fresh `Writer` with `resumeFrom` to pick up where the previous one stopped.

```js
import { Writer } from '@transcend-io/conflux';

// First attempt: record checkpoints as entries finish.
const checkpoints = [];
let archiveOffset = 0n;
const writer = new Writer(undefined, {
  onEntryComplete(checkpoint, offset) {
    checkpoints.push(checkpoint);
    archiveOffset = offset;
  },
});

// ... the sink fails after some entries were written ...

// Resume: truncate the on-disk file to `archiveOffset`, then write the
// remaining entries with a writer that already knows about the finished ones.
// Every remaining entry must have an explicit `lastModified` so the output
// matches what a single pass would have produced.
const resumed = new Writer(undefined, {
  resumeFrom: { offset: archiveOffset, entries: checkpoints },
});
remainingEntries.pipeThrough(resumed).pipeTo(fileStreamOpenedAtArchiveOffset);
```

A checkpoint is only safe to persist once the sink has accepted every byte up to the reported `offset`; the callback fires when the writer enqueues the descriptor, not when the bytes land on disk. Resumed archives are byte-identical to a single-pass archive of the same entries.

### Reading ZIP files

```js
import { Reader } from '@transcend-io/conflux';

fetch('https://cdn.jsdelivr.net/gh/Stuk/jszip/test/ref/deflate.zip').then(
  async (res) => {
    const zip = await res.blob();
    for await (const entry of Reader(zip)) {
      console.log(entry);
    }
  },
);
```

## Supporting Legacy Browsers

Conflux is compatible with all modern browsers since June 2022.

If you need to support legacy browsers, you can add polyfills for:

- [`TransformStream`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream), and [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream) (available in browsers since June 2022) by adding [web-streams-polyfill](https://www.npmjs.com/package/web-streams-polyfill).
- [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) (available in browsers since January 2020) by setting `globalThis.JSBI` equal to [JSBI](https://github.com/GoogleChromeLabs/jsbi) before importing Conflux.
- [`globalThis`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis) (available in browsers since January 2020) by adding a polyfill like this [globalthis](https://www.npmjs.com/package/globalthis) or manually setting a shim.

## License

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux?ref=badge_large)
