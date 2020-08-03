/* eslint-disable no-restricted-syntax, no-continue */
const fs = require('fs').promises;
const path = require('path');
const mod = require('./mod.js').default;

const { replacer } = mod();

fs.readdir(path.resolve(__dirname, './fixture')).then(async (files) => {
  const fixtures = {};

  for (const file of files) {
    if (!/(gif|zip)$/.test(file)) continue;
    fixtures[file] = new Uint8Array(
      await fs.readFile(path.resolve(__dirname, './fixture', file)),
    );
  }

  const replaced = JSON.stringify(fixtures, replacer, 2);
  fs.writeFile(path.resolve(__dirname, './fixtures.json'), replaced);
});
