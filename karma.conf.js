// Karma configuration
// Generated on Fri Jul 01 2016 13:05:39 GMT+0900 (東京 (標準時))

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai-sinon'],


    // list of files / patterns to load in the browser
    files: [
      'node_modules/leaflet/dist/leaflet.css',
      'node_modules/leaflet/dist/leaflet-src.js',
      'node_modules/esri-leaflet/dist/esri-leaflet-debug.js',
      'node_modules/leaflet-shape-markers/dist/leaflet-shape-markers.js',
      'node_modules/esri-leaflet-renderers/dist/esri-leaflet-renderers-debug.js',
      'node_modules/leaflet.heat/dist/leaflet-heat.js',
      'node_modules/esri-leaflet-heatmap-feature-layer/dist/esri-leaflet-heatmap-feature-layer.js',
      'node_modules/leaflet-vectoricon/L.VectorIcon.js',
      'node_modules/leaflet-omnivore/leaflet-omnivore.js',
      'dist/esri-leaflet-webmap-debug.js',
      'spec/**/*.js'
    ],


    // list of files to exclude
    exclude: [],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'dist/**/*.js': ['sourcemap', 'coverage']
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['PhantomJS'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,

    // Configure the coverage reporters
    coverageReporter: {
      instrumenters: {
        isparta: require('isparta')
      },
      instrumenter: {
        'src/**/*.js': 'isparta'
      },
      reporters: [
        {type: 'html', dir: 'coverage/'},
        {type: 'text'}
      ]
    }
  })
}
