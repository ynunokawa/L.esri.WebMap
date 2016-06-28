import { rollup } from 'rollup';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';

var pkg = require('../package.json');
var copyright = '/* ' + pkg.name + ' - v' + pkg.version + ' - ' + new Date().toString() + '\n' +
                ' * Copyright (c) ' + new Date().getFullYear() + ' Yusuke Nunokawa <nuno0825@gmail.com>\n' +
                ' * ' + pkg.license + ' */';

export default {
  entry: 'src/EsriLeafletWebMap.js',
  moduleName: 'L.esri',
  format: 'umd',
  external: ['leaflet', 'esri-leaflet'],
  plugins: [
    nodeResolve({
      jsnext: true,
      main: false,
      browser: false,
      extensions: [ '.js', '.json' ]
    }),
    json()
  ],
  globals: {
    'leaflet': 'L',
    'esri-leaflet': 'L.esri'
  },
  banner: copyright
}
