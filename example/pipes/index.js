/* eslint-disable no-restricted-syntax */
import streamSaver from 'streamsaver';
import { Writer } from '../../src/index.js';

const { readable, writable } = new Writer();
const writer = writable.getWriter();

const fileStream = streamSaver.createWriteStream('conflux.zip');

(async () => {
  const files = [
    'NYT.txt',
    'water.png',
    'Earth.jpg',
    'turtl.gif',
    'africa.topo.json',
    'k.webm',
    'river.jpg',
    'patreon.mp4',
  ];

  for (const file of files) {
    const { body } = await fetch(
      `https://s3-us-west-2.amazonaws.com/bencmbrook/${file}`,
    );

    writer.write({
      name: `/${file}`,
      stream: () => body,
    });
  }

  readable.pipeTo(fileStream);

  writer.close();
})();
