import Conflux from '../write.js'

const {
  WritableStream,
  Response,
  Benchmark,
  Blob,
  JSZip,
  zip
} = window

zip.useWebWorkers = false

const uint8 = new Uint8Array(256)
for (let i = 0; i < uint8.length; i++) uint8[i] = i

let blob = new Blob(new Array(2000).fill(uint8))
let text = null
let uInt8 = null

const suite = new Benchmark.Suite()
const file = { name: 'Hello.txt', stream: () => new Response(blob).body }

// add tests
suite
  .add('JSZip - from Blob', {
    defer: true,
    fn (p) {
      const zip = new JSZip()
      zip.file('Hello.txt', blob)
      zip.generateAsync({ type: 'blob' }).then(content => p.resolve())
    }
  })
  .add('JSZip - from Uint8Array', {
    defer: true,
    fn (p) {
      const zip = new JSZip()
      zip.file('Hello.txt', uInt8)
      zip.generateAsync({ type: 'blob' }).then(content => p.resolve())
    }
  })
  .add('JSZip - from String', {
    defer: true,
    fn (p) {
      const zip = new JSZip()
      zip.file('Hello.txt', text)
      zip.generateAsync({ type: 'blob' }).then(content => p.resolve())
    }
  })
  .add('zip.js - from Blob', {
    defer: true,
    fn (p) {
      // use a BlobWriter to store the zip into a Blob object
      zip.createWriter(new zip.BlobWriter('application/zip'), function (writer) {
        // use a BlobReader object to read the data stored into blob variable
        writer.add('Hello.txt', new zip.BlobReader(blob), function () {
          // close the writer and calls callback function
          writer.close(() => p.resolve())
        })
      }, console.error, { dontDeflate: true })
    }
  })
  .add('zip.js - from Text', {
    defer: true,
    fn (p) {
      // use a BlobWriter to store the zip into a Blob object
      zip.createWriter(new zip.BlobWriter('application/zip'), function (writer) {
        // use a BlobReader object to read the data stored into blob variable
        writer.add('Hello.txt', new zip.BlobReader(blob), function () {
          // close the writer and calls callback function
          writer.close(() => p.resolve())
        })
      }, console.error, { dontDeflate: true })
    }
  })
  .add('Conflux - Response to blob', {
    defer: true,
    fn (p) {
      const { writable, readable } = new Conflux()
      const writer = writable.getWriter()
      const res = new Response(readable, { headers: { 'content-type': 'application/zip' } })
      res.blob().then(blob => p.resolve())

      writer.write(file)
      writer.close()
    }
  })
  .add('Conflux - pipeTo Writable Blob builder', {
    defer: true,
    fn (p) {
      const { writable, readable } = new Conflux()
      const writer = writable.getWriter()
      const chunks = []
      const ws = new WritableStream({
        write (chunk) {
          chunks.push(chunk)
        },
        close () {
          new Blob(chunks, { type: 'application/zip' })
          p.resolve()
        }
      })
      readable.pipeTo(ws)
      writer.write(file)
      writer.close()
    }
  })
  .add('Conflux - pipeTo noop Writable', {
    defer: true,
    fn (p) {
      const { writable, readable } = new Conflux()
      const writer = writable.getWriter()
      const ws = new WritableStream({
        write () {},
        close () { p.resolve() }
      })
      readable.pipeTo(ws)
      writer.write(file)
      writer.close()
    }
  })
  // add listeners
  .on('cycle', event => {
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })

new Response(blob).arrayBuffer().then(buf => {
  new Response(blob).text().then(txt => {
    uInt8 = new Uint8Array(buf)
    text = txt
    suite.run({ async: true })
  })
})
