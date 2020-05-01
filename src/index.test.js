Blob.prototype.stream = function() {
  return new Response(this).body
}
Blob.prototype.arrayBuffer = function() {
  return new Response(this).arrayBuffer()
}
Blob.prototype.text = function() {
  return new Response(this).text()
}
require('./read.test.js');
require('./write.test.js');
require('../test/fixture/fixture.test.js');
