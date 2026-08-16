module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      stage: 3,
      features: {
        'custom-properties': true,
        'nesting-rules': true
      },
      browsers: 'ios >= 10'
    },
    'autoprefixer': {}
  }
}