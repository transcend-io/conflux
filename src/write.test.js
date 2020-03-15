import test from 'tape';
import { Writer } from './index.js';

test('autopass write', (t) => {
  t.isEqual(typeof Writer, 'function');
  t.pass('asdf');
  t.end();
});
