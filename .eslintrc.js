module.exports = {
  parser: '@babel/eslint-parser',
  env: {
    browser: true,
  },
  extends: ['airbnb-base'],
  plugins: ['import'],
  rules: {
    'no-bitwise': 'off',
    'max-len': ['error', 125, { comments: 200 }],
    'no-await-in-loop': 'off',
    'no-plusplus': 'off',
    'import/extensions': ['error', 'always'],
    'max-classes-per-file': 'off',

    /** Handled by prettier */
    'comma-dangle': 0,
    'operator-linebreak': 0,
    'implicit-arrow-linebreak': 0,
    '@typescript-eslint/indent': 0,
    'object-curly-newline': 0,
    'template-curly-spacing': 0,
    'newline-per-chained-call': 0,
    'generator-star-spacing': 0,
    'computed-property-spacing': 0,
    'space-before-function-paren': 0,
    indent: 0,
    'function-paren-newline': 0,
    'no-confusing-arrow': 0,
    'no-multi-spaces': 0,
    'object-property-newline': 0,
    'brace-style': 0,
  },
};
