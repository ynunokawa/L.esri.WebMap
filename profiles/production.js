import uglify from 'rollup-plugin-uglify';
import config from './base.js'

config.dest = 'dist/esri-leaflet-webmap.js';
config.sourceMap = 'dist/esri-leaflet-webmap.js.map';

// use a Regex to preserve copyright text
config.plugins.push(uglify({ output: { comments: /<ynunokawa.dev@gmail.com>/} }));

export default config;
