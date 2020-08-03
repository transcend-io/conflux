module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: '> 0.25%, not dead',
      },
    ],
  ],
  plugins: [
    '@babel/plugin-transform-classes',
    '@babel/plugin-proposal-optional-chaining',
  ],
};
