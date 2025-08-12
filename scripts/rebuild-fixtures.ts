import fs from 'node:fs/promises';
import path from 'node:path';
import { jsonBinaryBlobCodec } from '../test/json-binary-blob-codec.js';

const { replacer } = jsonBinaryBlobCodec;

const pathname = new URL(import.meta.url).pathname;
const __dirname = path.dirname(pathname);

const files = await fs.readdir(path.resolve(__dirname, '../test/fixture'));
const fixtures: Record<string, Uint8Array> = {};
for (const file of files) {
  if (file.endsWith('.zip') || file.endsWith('.gif')) {
    fixtures[file] = new Uint8Array(
      await fs.readFile(path.resolve(__dirname, '../test/fixture', file)),
    );
  }
}
const replaced = JSON.stringify(fixtures, replacer, 2);
await fs.writeFile(path.resolve(__dirname, '../test/fixtures.json'), replaced);
