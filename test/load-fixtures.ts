import jsonBinaryBlobCodec from './json-binary-blob-codec.js';
import fixtures from './fixtures.json' with { type: 'json' };

const { reviver } = jsonBinaryBlobCodec;
export default JSON.parse(JSON.stringify(fixtures), reviver) as Record<
  keyof typeof fixtures,
  Blob
>;
