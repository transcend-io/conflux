import test from 'tape';
import { Reader } from './index.js';

test('autopass read', (t) => {
  t.isEqual(typeof Reader, 'function');
  t.pass('asdf');
  t.end();
});
