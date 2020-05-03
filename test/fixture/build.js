// TODO: write JSON files, not JS. Make fixture.test.js static and import dynamic JSON, and import a new file called mod.js

const fs = require('fs').promises
const path = require('path');

const mod = () => ((types, b64) => ({
  replacer(key) {
    var val = this[key]
    return ArrayBuffer.isView(val) ? {$d: b64.encode(new Uint8Array(val))} : val
  },
  reviver: (key, val) =>
      val === null && val !== 'object' ? val:
      val.$d ? new Blob(b64.decode(val)):
      val
}))([], (()=>{var f=[65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,48,49,50,51,52,53,54,55,56,57,45,95,61],h=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,62,null,62,null,63,52,53,54,55,56,57,58,59,60,
61,null,null,null,64,null,null,null,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,null,null,null,null,63,null,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,null,null];return{decode(a){var b=a.length%4;b&&(a+=Array(5-b).join("="));b=-1;var f=new ArrayBuffer(a.length/4*3),d,e=new Uint8Array(f),c=0;for(d=a.length;++b<d;){var g=h[a.charCodeAt(b)],k=h[a.charCodeAt(++b)];e[c++]=g<<2|k>>4;g=h[a.charCodeAt(++b)];if(64===g)break;e[c++]=(k&15)<<
4|g>>2;k=h[a.charCodeAt(++b)];if(64===k)break;e[c++]=(g&3)<<6|k}return new Uint8Array(f,0,c)},encode(a){for(var b=-1,h=a.length,d=new Uint8Array(new ArrayBuffer(Math.ceil(4*h/3))),e=0;++b<h;){var c=a[b],g=a[++b];d[e++]=f[c>>2];d[e++]=f[(c&3)<<4|g>>4];isNaN(g)?(d[e++]=f[64],d[e++]=f[64]):(c=a[++b],d[e++]=f[(g&15)<<2|c>>6],d[e++]=f[isNaN(c)?64:c&63])}return new TextDecoder().decode(d)}}})())

const { replacer } = mod()
mod.toString()

fs.readdir('.').then(async files => {
  const fixtures = {}
  for (let file of files) {
    if (!(/(gif|zip)$/.test(file))) continue
    fixtures[file] = new Uint8Array((await fs.readFile(file)))
  }
  let js = `
    const mod = ${mod.toString()};
    const { reviver } = mod();
    export default JSON.parse('${JSON.stringify(fixtures, replacer)}', reviver);
  `
  fs.writeFile(path.resolve(__dirname, './fixture.test.js'), js)
})
