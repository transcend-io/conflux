<p align="center">
  <img alt="Conflux by Transcend" src="https://user-images.githubusercontent.com/7354176/61584253-73ecfb00-aaf9-11e9-91a5-a62e5ba6efc6.png"/>
</p>
<h1 align="center">Conflux</h1>
<p align="center">
  <strong>Build and read zip files with whatwg streams in the browser.</strong>
  <br /><br />
  <span>/ˈkänˌfləks/</span>
  (<i>noun</i>)<span> a flowing together of two or more streams</span><br /><br />
  <i>Coming soon. This repo is currently a work in progress.</i>
  <br /><br />
  <a href="https://travis-ci.com/transcend-io/conflux"><img src="https://travis-ci.com/transcend-io/conflux.svg?branch=master" alt="Build Status"></a>
  <a href="https://snyk.io//test/github/transcend-io/conflux?targetFile=package.json"><img src="https://snyk.io//test/github/transcend-io/conflux/badge.svg?targetFile=package.json" alt="Known Vulnerabilities"></a>
  <a href="https://codecov.io/gh/transcend-io/conflux"><img src="https://codecov.io/gh/transcend-io/conflux/branch/master/graph/badge.svg" alt="Code Coverage"></a>
  <a href="https://codeclimate.com/github/transcend-io/conflux/maintainability"><img src="https://api.codeclimate.com/v1/badges/ec9cfcc2963755b30c0d/maintainability" /></a>
  <a href="https://app.netlify.com/sites/conflux/deploys"><img src="https://api.netlify.com/api/v1/badges/8315091c-798e-4a3e-bdf9-2fd21c7a025e/deploy-status" alt="Netlify Status"></a>
  <br /><br />
  <a href="https://saucelabs.com/u/bencmbrook"><img src="https://saucelabs.com/browser-matrix/bencmbrook.svg?auth=c2b96594999df3d684c9af8d63a0c61e" alt="Sauce Test Status"></a>
</p>
<br />

## Usage

### Importing Conflux

```sh
npm install --save @transcend-io/conflux
```

```js
import Zip from '@transcend-io/conflux/write';

const { readable, writable } = new Zip();
```

### Writing a ZIP

```js
import Zip from '@transcend-io/conflux/write';
import streamSaver from 'streamsaver'

// Set up conflux
const { readable, writable } = new Zip();
const writer = writable.getWriter();

// Set up streamsaver
const fileStream = streamSaver.createWriteStream('conflux.zip');

// Add a file
writer.write({
  name: '/cat.txt',
  lastModified: new Date(0),
  stream: () => new Response('mjau').body
});

readable.pipeTo(fileStream);

writer.close();
```

### Incorporating other streams

```js
(async () => {
  writer.write({
    name: '/cat.txt',
    lastModified: new Date(0),
    stream: () => new Response('mjau').body,
  });

  const imgStream = await fetch('https://s3-us-west-2.amazonaws.com/bencmbrook/Earth.jpg')
    .then(r => r.body);

  writer.write({
    name: '/Earth.jpg',
    lastModified: new Date(0),
    stream: () => imgStream,
  });

  readable
    .pipeTo(fileStream)

  writer.close();
})();
```

### Reading ZIP files

```js
import reader from '@transcend-io/conflux/read';

fetch("https://cdn.jsdelivr.net/gh/Stuk/jszip/test/ref/deflate.zip")
  .then(async res => {
    for await (const entry of reader(zip)) {
      console.log(entry);
    }
  });
```

## Big Thanks

Cross-browser Testing Platform and Open Source <3 Provided by [Sauce Labs][homepage]

[homepage]: https://saucelabs.com
