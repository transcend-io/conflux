import { jsonBinaryBlobCodec } from './json-binary-blob-codec.js';
import fixturesRaw from './fixtures.json' with { type: 'json' };

const { reviver } = jsonBinaryBlobCodec;
export const fixtures = JSON.parse(
  JSON.stringify(fixturesRaw),
  reviver,
) as Record<keyof typeof fixturesRaw, Blob>;
