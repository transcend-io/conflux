module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'entry',
        targets: '> 0.25%, not dead',
        corejs: { version: 3, proposals: true },
      },
    ],
  ],
};
