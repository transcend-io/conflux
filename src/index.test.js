Blob.prototype.stream = function stream() {
  return new Response(this).body;
};

Blob.prototype.arrayBuffer = function arrayBuffer() {
  return new Response(this).arrayBuffer();
};

Blob.prototype.text = function text() {
  return new Response(this).text();
};

require('./read.test.js');
require('./write.test.js');
