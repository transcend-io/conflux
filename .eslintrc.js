module.exports = {
  env: {
    browser: true,
  },
  extends: [
    "airbnb-base",
    'prettier',
    'plugin:prettier/recommended',
  ],
  rules: {
    "no-bitwise": "off",
    "max-len": ["error", 125, { "comments": 200 }],
    "no-await-in-loop": "off",
    "no-plusplus": "off",
    "import/extensions": ["error", "always"],
    "max-classes-per-file": "off",
  },
};
