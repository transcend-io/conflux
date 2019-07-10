module.exports = {
  env: {
    browser: true,
  },
  extends: [
    "airbnb-base",
  ],
  rules: {
    "no-bitwise": "off",
    "max-len": ["error", 125, { "comments": 200 }],
    "no-await-in-loop": "off",
  },
};
