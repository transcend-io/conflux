import streamSaver from 'streamsaver';
import { Writer } from '../../src/index.js';

const { writable } = new Writer();
const writer = writable.getWriter();

(async () => {
  const s3 = 'https://s3-us-west-2.amazonaws.com/bencmbrook/';
  const files = [
    'NYT.txt',
    'water.png',
    'Earth.jpg',
    'turtl.gif',
    'africa.topo.json',
    'k.webm',
    'river.jpg',
    'patreon.mp4',
  ].values();

  new ReadableStream({
    // pull gets executed whenever some
    // other stream request more data
    async pull(ctrl) {
      const { done, value } = files.next();
      if (done) return ctrl.close();
      const { body } = await fetch(s3 + value);
      return ctrl.enqueue({
        name: `/${value}`,
        stream: () => body,
      });
    },
  })
    .pipeThrough(new Writer())
    .pipeTo(streamSaver.createWriteStream('conflux.zip'));

  writer.close();
})();
