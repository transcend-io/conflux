import { Writer } from '../../src/index.js';

const { readable, writable } = new Writer();
const writer = writable.getWriter();
const reader = readable.getReader();

const chunks = [];
let size = 0;

// switched `new Response(readanöe).blob` for a manual blob builder
// fetch can't read a polyfilled ReadableStream.
// https://github.com/MattiasBuelens/web-streams-polyfill/issues/20
const pump = () =>
  reader.read().then(async (it) => {
    if (it.done) {
      const uint8 = new Uint8Array(size);
      let o = 0;
      chunks.forEach((c) => {
        uint8.set(c, o);
        o += c.length;
      });

      const hash = await crypto.subtle.digest('sha-1', uint8);
      const expected = '18282460561088092989-11685288625477285951386915632';
      const blob = new Blob([uint8], { type: 'application/zip' });
      const a = document.createElement('a');

      a.href = URL.createObjectURL(blob);
      a.innerText = 'Archive.zip';
      a.download = 'Archive.zip';

      document.body.appendChild(a);
      document.body.appendChild(
        document.createTextNode(
          new Int32Array(hash).join('') === expected ? ' ✅' : ' ❌',
        ),
      );
    } else {
      chunks.push(it.value);
      size += it.value.length;
      pump();
    }
  });
pump();

writer.write({
  name: '/cat.txt',
  lastModified: new Date(0),
  stream: () => new Response('mjau').body,
});
writer.write({
  lastModified: new Date(0),
  name: '/folder/',
  directory: true,
});

writer.close();
