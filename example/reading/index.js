/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */
import { Reader } from '../../src/index.js';

const jszip = 'https://cdn.jsdelivr.net/gh/Stuk/jszip/test/ref/';
const urls = [
  /* 01 */ `${jszip}all-stream.zip`, // ok
  /* 01 */ `${jszip}all.7zip.zip`, // ok
  /* 02 */ `${jszip}all.windows.zip`, // ok
  /* 03 */ `${jszip}all.zip`, // ok
  /* 04 */ `${jszip}all_appended_bytes.zip`, // ok
  /* 05 */ `${jszip}all_missing_bytes.zip`, // fail as it should
  /* 06 */ `${jszip}all_prepended_bytes.zip`, // fail
  /* 07 */ `${jszip}archive_comment.zip`, // ok
  /* 08 */ `${jszip}backslash.zip`, // ok
  /* 09 */ `${jszip}data_descriptor.zip`, // ok
  /* 10 */ `${jszip}deflate-stream.zip`, // ok
  /* 11 */ `${jszip}deflate.zip`, // ok
  /* 12 */ `${jszip}empty.zip`, // ok
  /* 13 */ `${jszip}encrypted.zip`,
  /* 14 */ `${jszip}extra_attributes.zip`, // ???
  /* 15 */ `${jszip}folder.zip`, // ok
  /* 16 */ `${jszip}image.zip`, // ok
  /* 17 */ `${jszip}local_encoding_in_name.zip`, // unsolvable?
  /* 18 */ `${jszip}nested.zip`, // ok
  /* 19 */ `${jszip}nested_data_descriptor.zip`, // ok
  /* 20 */ `${jszip}nested_zip64.zip`, // fail
  /* 21 */ `${jszip}pile_of_poo.zip`, // ok
  /* 22 */ `${jszip}slashes_and_izarc.zip`, // ok
  /* 23 */ `${jszip}store-stream.zip`, // ok
  /* 24 */ `${jszip}store.zip`, // ok
  /* 25 */ `${jszip}subfolder.zip`, // ok
  /* 26 */ `${jszip}text.zip`, // oK
  /* 27 */ `${jszip}utf8.zip`, // ok
  /* 28 */ `${jszip}utf8_in_name.zip`, // ok
  /* 29 */ `${jszip}winrar_utf8_in_name.zip`, // fail to read content?
  /* 30 */ `${jszip}zip64.zip`, // fail
  /* 31 */ `${jszip}zip64_appended_bytes.zip`, // fail
  /* 32 */ `${jszip}zip64_missing_bytes.zip`, // fail
];

async function getTableEntries(url) {
  console.log(`Reading ${url} ...`);
  const res = await fetch(url);
  const zip = await res.blob();
  const entries = [];

  for await (const entry of Reader(zip)) {
    const {
      comment,
      name,
      directory,
      compressionMethod,
      size,
      compressedSize,
    } = entry;

    entries.push({
      comment,
      name,
      directory,
      compressionMethod,
      size,
      compressedSize,
      ab: entry.encrypted ? null : await entry.arrayBuffer(),
      body: entry.encrypted ? null : await entry.text(),
      url: entry.encrypted
        ? null
        : URL.createObjectURL(
            new Blob([await entry.arrayBuffer()], { type: 'd/d' }),
          ),
    });
  }

  return entries;
}

urls.forEach(async (url) => {
  let entries;
  let error;
  try {
    entries = await getTableEntries(url);
  } catch (err) {
    console.error(err);
    error = err;
  }

  /**
   * Everything below here is just making HTML tables
   */

  // Append to table
  const div = document.getElementById('tables');

  const header = document.createElement('h5');
  header.className = 'h5 mt-5';
  const a = document.createElement('a');
  const aText = document.createTextNode(url);
  a.href = url;
  a.appendChild(aText);
  header.appendChild(a);
  div.appendChild(header);

  const feedbackMessage = document.createElement('pre');
  let feedbackText;
  if (error) {
    feedbackText = document.createTextNode(error.stack);
  } else {
    feedbackText = document.createTextNode('Success');
  }
  feedbackMessage.appendChild(feedbackText);
  div.appendChild(feedbackMessage);

  const table = document.createElement('table');

  // Generate header row
  const headerRow = document.createElement('tr');
  Object.keys(entries[0]).forEach((name) => {
    const th = document.createElement('th');
    const text = document.createTextNode(name);
    th.appendChild(text);
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Generate content rows
  entries.forEach((row) => {
    const tr = document.createElement('tr');
    Object.values(row).forEach((cellText) => {
      const td = document.createElement('td');

      let parsedText;
      try {
        parsedText = JSON.stringify(cellText, null, 2);
      } catch (err) {
        parsedText = cellText;
      }

      const text = document.createTextNode(parsedText);
      td.appendChild(text);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  div.appendChild(table);
});
