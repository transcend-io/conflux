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
