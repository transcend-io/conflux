/* eslint-disable no-var, no-unused-expressions, no-restricted-globals,vars-on-top,prefer-destructuring,block-scoped-var,no-shadow */
const mod = () =>
  ((types, b64) => ({
    replacer(key) {
      const val = this[key];
      return ArrayBuffer.isView(val)
        ? { $d: b64.encode(new Uint8Array(val)) }
        : val;
    },
    reviver: (key, val) => {
      if (val === null && val !== 'object') {
        return val;
      }

      if (val.$d) {
        return new Blob([b64.decode(val.$d)]);
      }

      return val;
    },
  }))(
    [],
    (() => {
      const f = [
        65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82,
        83, 84, 85, 86, 87, 88, 89, 90, 97, 98, 99, 100, 101, 102, 103, 104,
        105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
        119, 120, 121, 122, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 45, 95, 61,
      ];
      const h = [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        62,
        null,
        62,
        null,
        63,
        52,
        53,
        54,
        55,
        56,
        57,
        58,
        59,
        60,
        61,
        null,
        null,
        null,
        64,
        null,
        null,
        null,
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        null,
        null,
        null,
        null,
        63,
        null,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        null,
        null,
      ];
      return {
        decode(a) {
          let b = a.length % 4;
          // eslint-disable-next-line no-param-reassign
          b && (a += Array(5 - b).join('='));
          b = -1;
          const f = new ArrayBuffer((a.length / 4) * 3);
          let d;
          const e = new Uint8Array(f);
          let c = 0;
          for (d = a.length; ++b < d; ) {
            let g = h[a.charCodeAt(b)];
            let k = h[a.charCodeAt(++b)];
            e[c++] = (g << 2) | (k >> 4);
            g = h[a.charCodeAt(++b)];
            if (g === 64) break;
            e[c++] = ((k & 15) << 4) | (g >> 2);
            k = h[a.charCodeAt(++b)];
            if (k === 64) break;
            e[c++] = ((g & 3) << 6) | k;
          }
          return new Uint8Array(f, 0, c);
        },
        encode(a) {
          for (
            var b = -1,
              h = a.length,
              d = new Uint8Array(new ArrayBuffer(Math.ceil((4 * h) / 3))),
              e = 0;
            ++b < h;

          ) {
            let c = a[b];
            const g = a[++b];
            d[e++] = f[c >> 2];
            d[e++] = f[((c & 3) << 4) | (g >> 4)];
            isNaN(g)
              ? ((d[e++] = f[64]), (d[e++] = f[64]))
              : ((c = a[++b]),
                (d[e++] = f[((g & 15) << 2) | (c >> 6)]),
                (d[e++] = f[isNaN(c) ? 64 : c & 63]));
          }
          return new TextDecoder().decode(d);
        },
      };
    })(),
  );

// // Exports for both ESM and CJS. This is imported by both the browser during Karma tests for fixture loading, and Node during fixture generation.
// Object.defineProperty(exports, '__esModule', {
//   value: true,
// });

// exports.default = mod;
export default mod; // TODO: address the Node import issue. This will break when running "yarn rebuild-fixtures"
/* eslint-enable no-var, no-unused-expressions,no-restricted-globals,vars-on-top,prefer-destructuring,block-scoped-var,no-shadow */
