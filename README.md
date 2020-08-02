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
  <a href="https://travis-ci.com/transcend-io/conflux"><img src="https://travis-ci.com/transcend-io/conflux.svg?branch=master" alt="Build Status"></a>
  <a href="https://automate.browserstack.com/public-build/NFlXc0MvaDRGQXVzSTNyY0lMbCtWM2RyekZsazZIaGRlQjl3cUxvQzFGTT0tLUkreEdTNUp1WGZvbkVVTUx3L1V1S1E9PQ==--3a59d2846f42b6c70d7873868ea6798a093f76e8%"><img src='https://automate.browserstack.com/badge.svg?badge_key=NFlXc0MvaDRGQXVzSTNyY0lMbCtWM2RyekZsazZIaGRlQjl3cUxvQzFGTT0tLUkreEdTNUp1WGZvbkVVTUx3L1V1S1E9PQ==--3a59d2846f42b6c70d7873868ea6798a093f76e8%'/></a>
  <a href="https://snyk.io//test/github/transcend-io/conflux?targetFile=package.json"><img src="https://snyk.io//test/github/transcend-io/conflux/badge.svg?targetFile=package.json" alt="Known Vulnerabilities"></a>
<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux?ref=badge_shield" alt="FOSSA Status"><img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux.svg?type=shield"/></a>
  <a href="https://codecov.io/gh/transcend-io/conflux"><img src="https://codecov.io/gh/transcend-io/conflux/branch/master/graph/badge.svg" alt="Code Coverage"></a>
  <!-- <a href="https://codeclimate.com/github/transcend-io/conflux/maintainability"><img src="https://api.codeclimate.com/v1/badges/ec9cfcc2963755b30c0d/maintainability" /></a> -->
  <br /><br />
</p>
<br />

## Blazing Fast

- 100 kB import
- Uses streams, minimizing memory overhead

## Compatibility

|         |          |
| ------- | -------: |
| Chrome  |       ✅ |
| Safari  |       ✅ |
| Edge    |       ✅ |
| Firefox |       ✅ |

## Usage

### Importing Conflux

```sh
# With Yarn
yarn add @transcend-io/conflux

# With NPM
npm install --save @transcend-io/conflux
```

```js
import { Writer } from '@transcend-io/conflux';

const { readable, writable } = new Writer();
```

### Writing a ZIP

```js
import { Writer } from '@transcend-io/conflux';

import streamSaver from "streamsaver";

// Set up conflux
const { readable, writable } = new Writer();
const writer = writable.getWriter();

// Set up streamsaver
const fileStream = streamSaver.createWriteStream("conflux.zip");

// Add a file
writer.write({
  name: "/cat.txt",
  lastModified: new Date(0),
  stream: () => new Response("mjau").body
});

readable.pipeTo(fileStream);

writer.close();
```

### Incorporating other streams

```js
import { Writer } from '@transcend-io/conflux';

const { readable, writable } = new Writer();
const writer = writable.getWriter();
const reader = readable.getReader();

(async () => {
  writer.write({
    name: "/cat.txt",
    lastModified: new Date(0),
    stream: () => new Response("mjau").body
  });

  const imgStream = await fetch(
    "https://s3-us-west-2.amazonaws.com/bencmbrook/Earth.jpg"
  ).then(r => r.body);

  writer.write({
    name: "/Earth.jpg",
    lastModified: new Date(0),
    stream: () => imgStream
  });

  readable.pipeTo(fileStream);

  writer.close();
})();
```

### Reading ZIP files

```js
import reader from "@transcend-io/conflux/read";

fetch("https://cdn.jsdelivr.net/gh/Stuk/jszip/test/ref/deflate.zip").then(
  async res => {
    const zip = await res.blob();
    for await (const entry of reader(zip)) {
      console.log(entry);
    }
  }
);
```

## License

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Ftranscend-io%2Fconflux?ref=badge_large)
