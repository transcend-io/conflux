import _regeneratorRuntime from '@babel/runtime-corejs3/regenerator';
import _asyncToGenerator from '@babel/runtime-corejs3/helpers/asyncToGenerator';
import _sliceInstanceProperty from '@babel/runtime-corejs3/core-js/instance/slice';
import _classCallCheck from '@babel/runtime-corejs3/helpers/classCallCheck';
import _createClass from '@babel/runtime-corejs3/helpers/createClass';
import _awaitAsyncGenerator from '@babel/runtime-corejs3/helpers/awaitAsyncGenerator';
import _wrapAsyncGenerator from '@babel/runtime-corejs3/helpers/wrapAsyncGenerator';
import { Inflate } from 'pako';
import _globalThis from '@babel/runtime-corejs3/core-js/global-this';
import JSBI$1 from 'jsbi';
import _Reflect$construct from '@babel/runtime-corejs3/core-js/reflect/construct';
import _inherits from '@babel/runtime-corejs3/helpers/inherits';
import _possibleConstructorReturn from '@babel/runtime-corejs3/helpers/possibleConstructorReturn';
import _getPrototypeOf from '@babel/runtime-corejs3/helpers/getPrototypeOf';
import _forEachInstanceProperty from '@babel/runtime-corejs3/core-js/instance/for-each';
import _endsWithInstanceProperty from '@babel/runtime-corejs3/core-js/instance/ends-with';
import _Date$now from '@babel/runtime-corejs3/core-js/date/now';
import _trimInstanceProperty from '@babel/runtime-corejs3/core-js/instance/trim';
import _Object$create from '@babel/runtime-corejs3/core-js/object/create';
import { TransformStream } from 'web-streams-polyfill/ponyfill';

var jsbi;
/**
 * If BigInt is natively supported, change JSBI to use native expressions
 * @see https://github.com/GoogleChromeLabs/jsbi/blob/master/jsbi.d.ts
 * @see https://github.com/GoogleChromeLabs/babel-plugin-transform-jsbi-to-bigint/blob/master/src/index.js
 */

if (_globalThis.BigInt) {
  jsbi = {}; // constructor

  jsbi['BigInt'] = function (a) {
    return BigInt(a);
  }; // note: JSBI toString is already the same: a.toString()


  jsbi['toNumber'] = function (a) {
    return Number(a);
  }; // binary functions to expressions


  jsbi['add'] = function (a, b) {
    return a + b;
  };

  jsbi['subtract'] = function (a, b) {
    return a - b;
  };

  jsbi['multiply'] = function (a, b) {
    return a * b;
  };

  jsbi['divide'] = function (a, b) {
    return a / b;
  };

  jsbi['remainder'] = function (a, b) {
    return a % b;
  };

  jsbi['exponentiate'] = function (a, b) {
    return Math.pow(a, b);
  };

  jsbi['leftShift'] = function (a, b) {
    return a << b;
  };

  jsbi['signedRightShift'] = function (a, b) {
    return a >> b;
  };

  jsbi['bitwiseAnd'] = function (a, b) {
    return a & b;
  };

  jsbi['bitwiseOr'] = function (a, b) {
    return a | b;
  };

  jsbi['bitwiseXor'] = function (a, b) {
    return a ^ b;
  };

  jsbi['equal'] = function (a, b) {
    return a === b;
  };

  jsbi['notEqual'] = function (a, b) {
    return a !== b;
  };

  jsbi['lessThan'] = function (a, b) {
    return a < b;
  };

  jsbi['lessThanOrEqual'] = function (a, b) {
    return a <= b;
  };

  jsbi['greaterThan'] = function (a, b) {
    return a > b;
  };

  jsbi['greaterThanOrEqual'] = function (a, b) {
    return a >= b;
  };

  jsbi['EQ'] = function (a, b) {
    return a == b;
  };

  jsbi['NE'] = function (a, b) {
    return a != b;
  };

  jsbi['LT'] = function (a, b) {
    return a < b;
  };

  jsbi['LE'] = function (a, b) {
    return a <= b;
  };

  jsbi['GT'] = function (a, b) {
    return a > b;
  };

  jsbi['GE'] = function (a, b) {
    return a >= b;
  };

  jsbi['ADD'] = function (a, b) {
    return a + b;
  }; // unary functions to expressions


  jsbi['unaryMinus'] = function (a) {
    return -a;
  };

  jsbi['bitwiseNot'] = function (a) {
    return ~a;
  }; // static methods


  jsbi['asIntN'] = function (a, b) {
    return BigInt.asIntN(a, b);
  };

  jsbi['asUintN'] = function (a, b) {
    return BigInt.asUintN(a, b);
  };
} else {
  jsbi = JSBI$1;
}

var JSBI = jsbi;

var Crc32 = /*#__PURE__*/function () {
  function Crc32() {
    _classCallCheck(this, Crc32);

    this.crc = -1;
  }

  _createClass(Crc32, [{
    key: "append",
    value: function append(data) {
      var crc = this.crc | 0;
      var table = this.table;

      for (var offset = 0, len = data.length | 0; offset < len; offset++) {
        crc = crc >>> 8 ^ table[(crc ^ data[offset]) & 0xff];
      }

      this.crc = crc;
    }
  }, {
    key: "get",
    value: function get() {
      return (this.crc ^ -1) >>> 0;
    }
  }]);

  return Crc32;
}();

Crc32.prototype.table = function (table, i, j, t) {
  for (i = 0; i < 256; i++) {
    t = i;

    for (j = 0; j < 8; j++) {
      t = t & 1 ? t >>> 1 ^ 0xedb88320 : t >>> 1;
    }

    table[i] = t;
  }

  return table;
}([], 0, 0, 0);

var ERR_BAD_FORMAT = 'File format is not recognized.';
var ZIP_COMMENT_MAX = 65536;
var EOCDR_MIN = 22;
var EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;
var MAX_VALUE_32BITS = 0xffffffff;
var decoder = new TextDecoder();

var uint16e = function uint16e(b, n) {
  return b[n] | b[n + 1] << 8;
};

var Entry = /*#__PURE__*/function () {
  function Entry(dataView, fileLike) {
    _classCallCheck(this, Entry);

    if (dataView.getUint32(0) !== 0x504b0102) {
      throw new Error('ERR_BAD_FORMAT');
    }

    var dv = dataView;
    this.dataView = dv;
    this._fileLike = fileLike;
    this._extraFields = {};

    for (var i = 46 + this.filenameLength; i < dv.byteLength;) {
      var _context;

      var id = dv.getUint16(i, true);
      var len = dv.getUint16(i + 2, true);
      var start = dv.byteOffset + i + 4;
      this._extraFields[id] = new DataView(_sliceInstanceProperty(_context = dv.buffer).call(_context, start, start + len));
      i += len + 4;
    }
  }

  _createClass(Entry, [{
    key: "stream",
    value: function stream() {
      var self = this;
      var crc = new Crc32();
      var inflator;

      var onEnd = function onEnd(ctrl) {
        return crc.get() === self.crc32 ? ctrl.close() : ctrl.error(new Error("The crc32 checksum don't match"));
      };

      return new ReadableStream({
        start: function start(ctrl) {
          var _this = this;

          return _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee() {
            var _context2, _context3;

            var ab, bytes, localFileOffset, start, end;
            return _regeneratorRuntime.wrap(function _callee$(_context4) {
              while (1) {
                switch (_context4.prev = _context4.next) {
                  case 0:
                    _context4.next = 2;
                    return _sliceInstanceProperty(_context2 = self._fileLike).call(_context2, self.offset + 26, self.offset + 30).arrayBuffer();

                  case 2:
                    ab = _context4.sent;
                    bytes = new Uint8Array(ab);
                    localFileOffset = uint16e(bytes, 0) + uint16e(bytes, 2) + 30;
                    start = self.offset + localFileOffset;
                    end = start + self.compressedSize;
                    _this.reader = _sliceInstanceProperty(_context3 = self._fileLike).call(_context3, start, end).stream().getReader();

                    if (self.compressionMethod) {
                      inflator = new Inflate({
                        raw: true
                      });

                      inflator.onData = function (chunk) {
                        crc.append(chunk);
                        ctrl.enqueue(chunk);
                      };

                      inflator.onEnd = function () {
                        return onEnd(ctrl);
                      };
                    }

                  case 9:
                  case "end":
                    return _context4.stop();
                }
              }
            }, _callee);
          }))();
        },
        pull: function pull(ctrl) {
          var _this2 = this;

          return _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee2() {
            var v;
            return _regeneratorRuntime.wrap(function _callee2$(_context5) {
              while (1) {
                switch (_context5.prev = _context5.next) {
                  case 0:
                    _context5.next = 2;
                    return _this2.reader.read();

                  case 2:
                    v = _context5.sent;
                    inflator ? !v.done && inflator.push(v.value) : v.done ? onEnd(ctrl) : (ctrl.enqueue(v.value), crc.append(v.value));

                  case 4:
                  case "end":
                    return _context5.stop();
                }
              }
            }, _callee2);
          }))();
        }
      });
    }
  }, {
    key: "arrayBuffer",
    value: function arrayBuffer() {
      return new Response(this.stream()).arrayBuffer().catch(function (e) {
        throw new Error("Failed to read Entry\n".concat(e));
      });
    }
  }, {
    key: "text",
    value: function text() {
      return new Response(this.stream()).text().catch(function (e) {
        throw new Error("Failed to read Entry\n".concat(e));
      });
    }
  }, {
    key: "file",
    value: function file() {
      var _this3 = this;

      return new Response(this.stream()).blob().then(function (blob) {
        return new File([blob], _this3.name, {
          lastModified: _this3.lastModified
        });
      }).catch(function (e) {
        throw new Error("Failed to read Entry\n".concat(e));
      });
    }
  }, {
    key: "versionMadeBy",
    get: function get() {
      return this.dataView.getUint16(4, true);
    }
  }, {
    key: "versionNeeded",
    get: function get() {
      return this.dataView.getUint16(6, true);
    }
  }, {
    key: "bitFlag",
    get: function get() {
      return this.dataView.getUint16(8, true);
    }
  }, {
    key: "encrypted",
    get: function get() {
      return (this.bitFlag & 0x0001) === 0x0001;
    }
  }, {
    key: "compressionMethod",
    get: function get() {
      return this.dataView.getUint16(10, true);
    }
  }, {
    key: "crc32",
    get: function get() {
      return this.dataView.getUint32(16, true);
    }
  }, {
    key: "compressedSize",
    get: function get() {
      return this.dataView.getUint32(20, true);
    }
  }, {
    key: "filenameLength",
    get: function get() {
      return this.dataView.getUint16(28, true);
    }
  }, {
    key: "extraFieldLength",
    get: function get() {
      return this.dataView.getUint16(30, true);
    }
  }, {
    key: "commentLength",
    get: function get() {
      return this.dataView.getUint16(32, true);
    }
  }, {
    key: "diskNumberStart",
    get: function get() {
      return this.dataView.getUint16(34, true);
    }
  }, {
    key: "internalFileAttributes",
    get: function get() {
      return this.dataView.getUint16(36, true);
    }
  }, {
    key: "externalFileAttributes",
    get: function get() {
      return this.dataView.getUint32(38, true);
    }
  }, {
    key: "directory",
    get: function get() {
      return !!(this.dataView.getUint8(38) & 16);
    }
  }, {
    key: "offset",
    get: function get() {
      return this.dataView.getUint32(42, true);
    }
  }, {
    key: "zip64",
    get: function get() {
      return this.dataView.getUint32(24, true) === MAX_VALUE_32BITS;
    }
  }, {
    key: "comment",
    get: function get() {
      var dv = this.dataView;
      var uint8 = new Uint8Array(dv.buffer, dv.byteOffset + this.filenameLength + this.extraFieldLength + 46, this.commentLength);
      return decoder.decode(uint8);
    } // File like IDL methods

  }, {
    key: "lastModifiedDate",
    get: function get() {
      var t = this.dataView.getUint32(12, true);
      return new Date( // Date.UTC(
      (t >> 25 & 0x7f) + 1980, // year
      (t >> 21 & 0x0f) - 1, // month
      t >> 16 & 0x1f, // day
      t >> 11 & 0x1f, // hour
      t >> 5 & 0x3f, // minute
      (t & 0x1f) << 1);
    }
  }, {
    key: "lastModified",
    get: function get() {
      return +this.lastModifiedDate;
    }
  }, {
    key: "name",
    get: function get() {
      if (!this.bitFlag && this._extraFields && this._extraFields[0x7075]) {
        var _context6;

        return decoder.decode(_sliceInstanceProperty(_context6 = this._extraFields[0x7075].buffer).call(_context6, 5));
      }

      var dv = this.dataView;
      var uint8 = new Uint8Array(dv.buffer, dv.byteOffset + 46, this.filenameLength);
      return decoder.decode(uint8);
    }
  }, {
    key: "size",
    get: function get() {
      var size = this.dataView.getUint32(24, true);
      return size === MAX_VALUE_32BITS ? this._extraFields[1].getUint8(0) : size;
    }
  }]);

  return Entry;
}();

function getBigInt64(view, position) {
  var littleEndian = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  if ('getBigInt64' in DataView.prototype) {
    return view.getBigInt64(position, littleEndian);
  }

  var value = JSBI.BigInt(0);
  var isNegative = (view.getUint8(position + (littleEndian ? 7 : 0)) & 0x80) > 0;
  var carrying = true;

  for (var i = 0; i < 8; i++) {
    var byte = view.getUint8(position + (littleEndian ? i : 7 - i));

    if (isNegative) {
      if (carrying) {
        if (byte != 0x00) {
          byte = ~(byte - 1) & 0xff;
          carrying = false;
        }
      } else {
        byte = ~byte & 0xff;
      }
    }

    value = JSBI.add(value, JSBI.multiply(JSBI.BigInt(byte), JSBI.exponentiate(JSBI.BigInt(256), JSBI.BigInt(i))));
  }

  if (isNegative) {
    value = JSBI.unaryMinus(value);
  }

  return value;
}

function Reader(_x) {
  return _Reader.apply(this, arguments);
}

function _Reader() {
  _Reader = _wrapAsyncGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee4(file) {
    var doSeek, _doSeek, dv, fileslength, centralDirSize, centralDirOffset, isZip64, l, relativeOffsetEndOfZip64CentralDir, zip64centralBlob, start, end, blob, bytes, i, index, size;

    return _regeneratorRuntime.wrap(function _callee4$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            _doSeek = function _doSeek3() {
              _doSeek = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee3(length) {
                var ab, bytes, _i;

                return _regeneratorRuntime.wrap(function _callee3$(_context7) {
                  while (1) {
                    switch (_context7.prev = _context7.next) {
                      case 0:
                        _context7.next = 2;
                        return _sliceInstanceProperty(file).call(file, file.size - length).arrayBuffer();

                      case 2:
                        ab = _context7.sent;
                        bytes = new Uint8Array(ab);
                        _i = bytes.length - EOCDR_MIN;

                      case 5:
                        if (!(_i >= 0)) {
                          _context7.next = 11;
                          break;
                        }

                        if (!(bytes[_i] === 0x50 && bytes[_i + 1] === 0x4b && bytes[_i + 2] === 0x05 && bytes[_i + 3] === 0x06)) {
                          _context7.next = 8;
                          break;
                        }

                        return _context7.abrupt("return", new DataView(bytes.buffer, _i, EOCDR_MIN));

                      case 8:
                        _i--;
                        _context7.next = 5;
                        break;

                      case 11:
                        return _context7.abrupt("return", null);

                      case 12:
                      case "end":
                        return _context7.stop();
                    }
                  }
                }, _callee3);
              }));
              return _doSeek.apply(this, arguments);
            };

            doSeek = function _doSeek2(_x2) {
              return _doSeek.apply(this, arguments);
            };

            if (!(file.size < EOCDR_MIN)) {
              _context8.next = 4;
              break;
            }

            throw new Error(ERR_BAD_FORMAT);

          case 4:
            _context8.next = 6;
            return _awaitAsyncGenerator(doSeek(EOCDR_MIN));

          case 6:
            _context8.t0 = _context8.sent;

            if (_context8.t0) {
              _context8.next = 11;
              break;
            }

            _context8.next = 10;
            return _awaitAsyncGenerator(doSeek(Math.min(EOCDR_MAX, file.size)));

          case 10:
            _context8.t0 = _context8.sent;

          case 11:
            dv = _context8.t0;

            if (dv) {
              _context8.next = 14;
              break;
            }

            throw new Error(ERR_BAD_FORMAT);

          case 14:
            fileslength = dv.getUint16(8, true);
            centralDirSize = dv.getUint32(12, true);
            centralDirOffset = dv.getUint32(16, true); // const fileCommentLength = dv.getUint16(20, true);

            isZip64 = centralDirOffset === MAX_VALUE_32BITS;

            if (!isZip64) {
              _context8.next = 35;
              break;
            }

            l = -dv.byteLength - 20;
            _context8.t1 = DataView;
            _context8.next = 23;
            return _awaitAsyncGenerator(_sliceInstanceProperty(file).call(file, l, -dv.byteLength).arrayBuffer());

          case 23:
            _context8.t2 = _context8.sent;
            dv = new _context8.t1(_context8.t2);
            // const signature = dv.getUint32(0, true) // 4 bytes
            // const diskWithZip64CentralDirStart = dv.getUint32(4, true) // 4 bytes
            relativeOffsetEndOfZip64CentralDir = JSBI.toNumber(getBigInt64(dv, 8, true)); // 8 bytes
            // const numberOfDisks = dv.getUint32(16, true) // 4 bytes

            zip64centralBlob = _sliceInstanceProperty(file).call(file, relativeOffsetEndOfZip64CentralDir, l);
            _context8.t3 = DataView;
            _context8.next = 30;
            return _awaitAsyncGenerator(zip64centralBlob.arrayBuffer());

          case 30:
            _context8.t4 = _context8.sent;
            dv = new _context8.t3(_context8.t4);
            // const zip64EndOfCentralSize = dv.getBigInt64(4, true)
            // const diskNumber = dv.getUint32(16, true)
            // const diskWithCentralDirStart = dv.getUint32(20, true)
            // const centralDirRecordsOnThisDisk = dv.getBigInt64(24, true)
            fileslength = JSBI.toNumber(getBigInt64(dv, 32, true));
            centralDirSize = JSBI.toNumber(getBigInt64(dv, 40, true));
            centralDirOffset = JSBI.toNumber(getBigInt64(dv, 48, true));

          case 35:
            if (!(centralDirOffset < 0 || centralDirOffset >= file.size)) {
              _context8.next = 37;
              break;
            }

            throw new Error(ERR_BAD_FORMAT);

          case 37:
            start = centralDirOffset;
            end = centralDirOffset + centralDirSize;
            blob = _sliceInstanceProperty(file).call(file, start, end);
            _context8.t5 = Uint8Array;
            _context8.next = 43;
            return _awaitAsyncGenerator(blob.arrayBuffer());

          case 43:
            _context8.t6 = _context8.sent;
            bytes = new _context8.t5(_context8.t6);
            i = 0, index = 0;

          case 46:
            if (!(i < fileslength)) {
              _context8.next = 56;
              break;
            }

            size = uint16e(bytes, index + 28) + // filenameLength
            uint16e(bytes, index + 30) + // extraFieldLength
            uint16e(bytes, index + 32) + // commentLength
            46;

            if (!(index + size > bytes.length)) {
              _context8.next = 50;
              break;
            }

            throw new Error('Invalid ZIP file.');

          case 50:
            _context8.next = 52;
            return new Entry(new DataView(bytes.buffer, index, size), file);

          case 52:
            index += size;

          case 53:
            i++;
            _context8.next = 46;
            break;

          case 56:
          case "end":
            return _context8.stop();
        }
      }
    }, _callee4);
  }));
  return _Reader.apply(this, arguments);
}

var _globalThis$WebStream;

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = _Reflect$construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !_Reflect$construct) return false; if (_Reflect$construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(_Reflect$construct(Date, [], function () {})); return true; } catch (e) { return false; } }
var encoder = new TextEncoder();

var ZipTransformer = /*#__PURE__*/function () {
  function ZipTransformer() {
    _classCallCheck(this, ZipTransformer);

    this.files = _Object$create(null);
    this.filenames = [];
    this.offset = JSBI.BigInt(0);
  }
  /**
   * [transform description]
   *
   * @param  {File}  entry [description]
   * @param  {ReadableStreamDefaultController}  ctrl
   * @return {Promise}       [description]
   */


  _createClass(ZipTransformer, [{
    key: "transform",
    value: function () {
      var _transform = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(entry, ctrl) {
        var _context;

        var name, date, nameBuf, zipObject, header, hdv, data, footer, reader, it, chunk;
        return _regeneratorRuntime.wrap(function _callee$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                name = _trimInstanceProperty(_context = entry.name).call(_context);
                date = new Date(typeof entry.lastModified === 'undefined' ? _Date$now() : entry.lastModified);
                if (entry.directory && !_endsWithInstanceProperty(name).call(name, '/')) name += '/';
                if (this.files[name]) ctrl.abort(new Error('File already exists.'));
                nameBuf = encoder.encode(name);
                this.filenames.push(name);
                this.files[name] = {
                  directory: !!entry.directory,
                  nameBuf: nameBuf,
                  offset: this.offset,
                  comment: encoder.encode(entry.comment || ''),
                  compressedLength: JSBI.BigInt(0),
                  uncompressedLength: JSBI.BigInt(0),
                  header: new Uint8Array(26)
                };
                zipObject = this.files[name];
                header = zipObject.header;
                hdv = new DataView(header.buffer);
                data = new Uint8Array(30 + nameBuf.length);
                hdv.setUint32(0, 0x14000808);
                hdv.setUint16(6, (date.getHours() << 6 | date.getMinutes()) << 5 | date.getSeconds() / 2, true);
                hdv.setUint16(8, (date.getFullYear() - 1980 << 4 | date.getMonth() + 1) << 5 | date.getDate(), true);
                hdv.setUint16(22, nameBuf.length, true);
                data.set([80, 75, 3, 4]);
                data.set(header, 4);
                data.set(nameBuf, 30);
                this.offset = JSBI.add(this.offset, JSBI.BigInt(data.length));
                ctrl.enqueue(data);
                footer = new Uint8Array(16);
                footer.set([80, 75, 7, 8]);

                if (!entry.stream) {
                  _context2.next = 42;
                  break;
                }

                zipObject.crc = new Crc32();
                reader = entry.stream().getReader();

              case 25:

                _context2.next = 28;
                return reader.read();

              case 28:
                it = _context2.sent;

                if (!it.done) {
                  _context2.next = 31;
                  break;
                }

                return _context2.abrupt("break", 38);

              case 31:
                chunk = it.value;
                zipObject.crc.append(chunk);
                zipObject.uncompressedLength = JSBI.add(zipObject.uncompressedLength, JSBI.BigInt(chunk.length));
                zipObject.compressedLength = JSBI.add(zipObject.compressedLength, JSBI.BigInt(chunk.length));
                ctrl.enqueue(chunk);
                _context2.next = 25;
                break;

              case 38:
                hdv.setUint32(10, zipObject.crc.get(), true);
                hdv.setUint32(14, JSBI.toNumber(zipObject.compressedLength), true);
                hdv.setUint32(18, JSBI.toNumber(zipObject.uncompressedLength), true);
                footer.set(header.subarray(10, 22), 4);

              case 42:
                hdv.setUint16(22, nameBuf.length, true);
                this.offset = JSBI.add(this.offset, JSBI.add(zipObject.compressedLength, JSBI.BigInt(16)));
                ctrl.enqueue(footer);

              case 45:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee, this);
      }));

      function transform(_x, _x2) {
        return _transform.apply(this, arguments);
      }

      return transform;
    }()
    /**
     * @param  {ReadableStreamDefaultController} ctrl
     */

  }, {
    key: "flush",
    value: function flush(ctrl) {
      var _context3,
          _this = this,
          _context4;

      var length = 0;
      var index = 0;
      var file;

      _forEachInstanceProperty(_context3 = this.filenames).call(_context3, function (fileName) {
        file = _this.files[fileName];
        length += 46 + file.nameBuf.length + file.comment.length;
      });

      var data = new Uint8Array(length + 22);
      var dv = new DataView(data.buffer);

      _forEachInstanceProperty(_context4 = this.filenames).call(_context4, function (fileName) {
        file = _this.files[fileName];
        dv.setUint32(index, 0x504b0102);
        dv.setUint16(index + 4, 0x1400);
        dv.setUint16(index + 32, file.comment.length, true);
        dv.setUint8(index + 38, file.directory ? 16 : 0);
        dv.setUint32(index + 42, JSBI.toNumber(file.offset), true);
        data.set(file.header, index + 6);
        data.set(file.nameBuf, index + 46);
        data.set(file.comment, index + 46 + file.nameBuf.length);
        index += 46 + file.nameBuf.length + file.comment.length;
      });

      dv.setUint32(index, 0x504b0506);
      dv.setUint16(index + 8, this.filenames.length, true);
      dv.setUint16(index + 10, this.filenames.length, true);
      dv.setUint32(index + 12, length, true);
      dv.setUint32(index + 16, JSBI.toNumber(this.offset), true);
      ctrl.enqueue(data); // cleanup

      this.files = _Object$create(null);
      this.filenames = [];
      this.offset = 0;
    }
  }]);

  return ZipTransformer;
}();

var ts = _globalThis.TransformStream || ((_globalThis$WebStream = _globalThis.WebStreamsPolyfill) === null || _globalThis$WebStream === void 0 ? void 0 : _globalThis$WebStream.TransformStream) || TransformStream;

var Writer = /*#__PURE__*/function (_ts) {
  _inherits(Writer, _ts);

  var _super = _createSuper(Writer);

  function Writer() {
    _classCallCheck(this, Writer);

    return _super.call(this, new ZipTransformer());
  }

  return Writer;
}(ts);

export { Reader, Writer };
