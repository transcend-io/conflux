/* global globalThis BigInt */

/**
 * Use JSBI syntax for BigInt operations, instead of calling BigInt directly.
 *
 * This is NOT a polyfill. This uses native BigInt. Using this syntax simply makes it possible to polyfill BigInt.
 * If BigInt is not natively supported (ES2020+), library consumer MUST expose globalThis.JSBI before using Conflux.
 *
 * @see https://github.com/GoogleChromeLabs/jsbi - JSBI library for why BigInt
 * @see https://github.com/GoogleChromeLabs/jsbi/blob/master/jsbi.d.ts - types
 */
if (!globalThis.BigInt && !globalThis.JSBI) {
  throw new Error(
    'BigInt is not supported in this browser.' +
      ' Conflux is unable to create zip files without BigInt support, or a JSBI polyfill.',
  );
}

const jsbi = globalThis.JSBI || {};

if (!jsbi.BigInt) {
  // constructor
  jsbi.BigInt = (a) => BigInt(a);

  // note: JSBI toString is already the same: a.toString()
  jsbi.toNumber = (a) => Number(a);

  // binary functions to expressions
  jsbi.add = (a, b) => a + b;
  jsbi.subtract = (a, b) => a - b;
  jsbi.multiply = (a, b) => a * b;
  jsbi.divide = (a, b) => a / b;
  jsbi.remainder = (a, b) => a % b;
  jsbi.exponentiate = (a, b) => a ** b;
  jsbi.leftShift = (a, b) => a << b;
  jsbi.signedRightShift = (a, b) => a >> b;
  jsbi.bitwiseAnd = (a, b) => a & b;
  jsbi.bitwiseOr = (a, b) => a | b;
  jsbi.bitwiseXor = (a, b) => a ^ b;
  jsbi.equal = (a, b) => a === b;
  jsbi.notEqual = (a, b) => a !== b;
  jsbi.lessThan = (a, b) => a < b;
  jsbi.lessThanOrEqual = (a, b) => a <= b;
  jsbi.greaterThan = (a, b) => a > b;
  jsbi.greaterThanOrEqual = (a, b) => a >= b;
  jsbi.EQ = (a, b) => a === b;
  jsbi.NE = (a, b) => a !== b;
  jsbi.LT = (a, b) => a < b;
  jsbi.LE = (a, b) => a <= b;
  jsbi.GT = (a, b) => a > b;
  jsbi.GE = (a, b) => a >= b;
  jsbi.ADD = (a, b) => a + b;

  // unary functions to expressions
  jsbi.unaryMinus = (a) => -a;
  jsbi.bitwiseNot = (a) => ~a;

  // static methods
  jsbi.asIntN = (a, b) => BigInt.asIntN(a, b);
  jsbi.asUintN = (a, b) => BigInt.asUintN(a, b);
}

export default jsbi;
