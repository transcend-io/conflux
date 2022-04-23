<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

## Table of Contents

- [Conflux](#conflux)
  - [Blazing Fast](#blazing-fast)
  - [Compatibility](#compatibility)
  - [Examples](#examples)
  - [Usage](#usage)
    - [Importing Conflux](#importing-conflux)
      - [Package Manager](#package-manager)
      - [CDN](#cdn)
    - [Creating a ZIP](#creating-a-zip)
      - [Example using `ReadableStream#pipeThrough`](#example-using-readablestreampipethrough)
      - [Example using `writer.write`](#example-using-writerwrite)
      - [Incorporating other streams](#incorporating-other-streams)
    - [Reading ZIP files](#reading-zip-files)
  - [Supporting Firefox](#supporting-firefox)
  - [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<p align="center">
  <img alt="Conflux by Transcend" src="https://user-images.githubusercontent.com/7354176/61584253-73ecfb00-aaf9-11e9-91a5-a62e5ba6efc6.png"/>
</p>
<h1 align="center">Conflux</h1>
<p align="center">
  <strong>Build and read zip files with whatwg streams in the browser.</strong>
  <br /><br />
  <span>/ˈkänˌfləks/</span>
  (<i>noun</i>)<span> a flowing together of two or more streams</span><br /><br />
  <br /><br />
<!--   <a href="https://travis-ci.com/transcend-io/conflux"><img src="https://travis-ci.com/transcend-io/conflux.svg?branch=master" alt="Build Status"></a> -->
<!--   <a href="https://automate.browserstack.com/public-build/NFlXc0MvaDRGQXVzSTNyY0lMbCtWM2RyekZsazZIaGRlQjl3cUxvQzFGTT0tLUkreEdTNUp1WGZvbkVVTUx3L1V1S1E9PQ==--3a59d2846f42b6c70d7873868ea6798a093f76e8"><img src='https://automate.browserstack.com/badge.svg?badge_key=OHUrN1VyL0FVdDhFUU9CQVJja0tMeHNEU0hsUzROUG9kSkt4MlA5MndYQT0tLWVuMDJMN01oeCtDM1lTN3ZFd1hSdnc9PQ==--0938f2738c3e2fca8e74a5365c4394a0710eee7a'/></a> -->
  <a href="https://snyk.io//test/github/transcend-io/conflux?targetFile=package.json"><img src="https://snyk.io//test/github/transcend-io/conflux/badge.svg?targetFile=package.json" alt="Known Vulnerabilities"></a>
<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux?ref=badge_shield" alt="FOSSA Status"><img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux.svg?type=shield"/></a>
<!--   <a href="https://codecov.io/gh/transcend-io/conflux"><img src="https://codecov.io/gh/transcend-io/conflux/branch/master/graph/badge.svg" alt="Code Coverage"></a> -->
  <!-- <a href="https://codeclimate.com/github/transcend-io/conflux/maintainability"><img src="https://api.codeclimate.com/v1/badges/ec9cfcc2963755b30c0d/maintainability" /></a> -->
  <br /><br />
</p>
<br />

## Blazing Fast

- ~100 kB import
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

#### Package Manager

```sh
# With Yarn
yarn add @transcend-io/conflux

# With NPM
npm install --save @transcend-io/conflux
```

```js
// Reader parses zip files, Writer builds zip files
import { Reader, Writer } from '@transcend-io/conflux';
```

#### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@transcend-io/conflux@3"></script>
```

```js
// Reader parses zip files, Writer builds zip files
const { Reader, Writer } = window.conflux;
```

### Creating a ZIP

#### Example using `ReadableStream#pipeThrough`

```js
import { Writer } from '@transcend-io/conflux';
import streamSaver from 'streamsaver';

const s3 = 'https://s3-us-west-2.amazonaws.com/bencmbrook/';
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
    'https://s3-us-west-2.amazonaws.com/bencmbrook/Earth.jpg',
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

## Supporting Firefox

Firefox [does not support ReadableStream#pipeThrough](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream#browser_compatibility), since it does not have `WritableStream` or `TransformStream` support yet. Conflux ponyfills `TransformStream` out of the box in Firefox, but if you're using the `myReadable.pipeThrough` and plan to support Firefox, you'll want to ponyfill `ReadableStream` like so:

```js
import { ReadableStream as ReadableStreamPonyfill } from 'web-streams-polyfill/ponyfill';

// Support Firefox with a ponyfill on ReadableStream to add .pipeThrough
const ModernReadableStream = window.WritableStream
  ? window.ReadableStream
  : ReadableStreamPonyfill;

const myReadable = new ModernReadableStream({
  async pull(controller) {
    return controller.enqueue({
      name: `/firefox.txt`,
      stream: () => new Response.body('Firefox works!'),
    });
  },
});

myReadable
  .pipeThrough(new Writer()) // see "Supporting Firefox" below
  .pipeTo(streamSaver.createWriteStream('conflux.zip'));
```

## License

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux?ref=badge_large)
