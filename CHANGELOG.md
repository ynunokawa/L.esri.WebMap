# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
This change log adheres to standards from [Keep a CHANGELOG](http://keepachangelog.com).

## [Unreleased]

## [0.3.3] - 2016-07-07

### Added

- [NPMCDN](https://npmcdn.com/esri-leaflet-webmap@0.3.3) (an alternative plan until added into jsdelivr)

## [0.3.2] - 2016-07-06

### Added

- CHANGELOG.md

## [0.3.1] - 2016-07-06

### Added

- `FeatureCollection` can load a feature collection using `itemId`
- Rendering FeatureLayer with drawingInfo using esri-leaflet-renderers [`2.0.3`](https://github.com/Esri/esri-leaflet-renderers/releases/tag/v2.0.3)
- `FeatureCollection` use renderer modules of esri-leaflet-renderers to render
- Test script with karma, mocha and chai
- Automatically checking with Travis CI

### Changed

- Separate module for a feature collection as [`FeatureCollection`](https://github.com/ynunokawa/L.esri.WebMap/blob/master/src/FeatureCollection/FeatureCollection.js)
- Separate module for labeling as [`LabelMarker`](https://github.com/ynunokawa/L.esri.WebMap/blob/master/src/Label/LabelMarker.js)

[Unreleased]: https://github.com/ynunokawa/L.esri.WebMap/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/ynunokawa/L.esri.WebMap/compare/0.3.0...v0.3.1