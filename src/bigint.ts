const jsbiShim = {
  // constructor
  BigInt: BigInt,

  // note: JSBI toString is already the same: a.toString()
  toNumber: Number,

  // binary functions to expressions
  add: (a: bigint, b: bigint) => a + b,
  subtract: (a: bigint, b: bigint) => a - b,
  multiply: (a: bigint, b: bigint) => a * b,
  divide: (a: bigint, b: bigint) => a / b,
  remainder: (a: bigint, b: bigint) => a % b,
  exponentiate: (a: bigint, b: bigint) => a ** b,
  leftShift: (a: bigint, b: bigint) => a << b,
  signedRightShift: (a: bigint, b: bigint) => a >> b,
  bitwiseAnd: (a: bigint, b: bigint) => a & b,
  bitwiseOr: (a: bigint, b: bigint) => a | b,
  bitwiseXor: (a: bigint, b: bigint) => a ^ b,
  equal: (a: bigint, b: bigint) => a === b,
  notEqual: (a: bigint, b: bigint) => a !== b,
  lessThan: (a: bigint, b: bigint) => a < b,
  lessThanOrEqual: (a: bigint, b: bigint) => a <= b,
  greaterThan: (a: bigint, b: bigint) => a > b,
  greaterThanOrEqual: (a: bigint, b: bigint) => a >= b,
  EQ: (a: bigint, b: bigint) => a == b,
  NE: (a: bigint, b: bigint) => a != b,
  LT: (a: bigint, b: bigint) => a < b,
  LE: (a: bigint, b: bigint) => a <= b,
  GT: (a: bigint, b: bigint) => a > b,
  GE: (a: bigint, b: bigint) => a >= b,
  ADD: (a: bigint, b: bigint) => a + b,

  // unary functions to expressions
  unaryMinus: (a: bigint) => -a,
  bitwiseNot: (a: bigint) => ~a,

  // static methods
  asIntN: (a: number, b: bigint) => BigInt.asIntN(a, b),
  asUintN: (a: number, b: bigint) => BigInt.asUintN(a, b),
};

type JSBI = typeof jsbiShim;

declare global {
  interface Window {
    JSBI?: JSBI;
  }
}

if (!(self.BigInt as unknown) && !self.JSBI) {
  throw new Error(
    'BigInt is not supported in this browser.' +
      ' Conflux is unable to create zip files without BigInt support, or a JSBI polyfill.',
  );
}

/**
 * Use JSBI syntax for BigInt operations, instead of calling BigInt directly.
 *
 * This is NOT a polyfill. It uses native BigInt by default. Using this syntax simply makes it _possible_ to polyfill BigInt.
 * If BigInt is not natively supported (ES2020+), library consumer MUST expose globalThis.JSBI before using Conflux.
 *
 * @see https://github.com/GoogleChromeLabs/jsbi - JSBI library for why BigInt
 * @see https://github.com/GoogleChromeLabs/jsbi/blob/master/jsbi.d.ts - types
 */
const jsbi: JSBI =
  !(self.BigInt as unknown) && self.JSBI ? self.JSBI : jsbiShim;

export default jsbi;
