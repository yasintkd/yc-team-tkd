module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-custom-properties': {
      preserve: true,
      warnings: false,
    },
    'postcss-preset-env': {
      stage: 3,
      features: {
        'nesting-rules': true
      },
      browsers: ['> 0.5%', 'last 2 versions', 'iOS >= 9']
    },
    'autoprefixer': {}
  }
}