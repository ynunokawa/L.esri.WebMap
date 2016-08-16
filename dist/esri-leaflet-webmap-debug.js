/* esri-leaflet-webmap - v0.3.4 - Tue Aug 16 2016 15:26:31 GMT+0900 (東京 (標準時))
 * Copyright (c) 2016 Yusuke Nunokawa <nuno0825@gmail.com>
 * MIT */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet')) :
	typeof define === 'function' && define.amd ? define(['exports', 'leaflet'], factory) :
	(factory((global.L = global.L || {}, global.L.esri = global.L.esri || {}),global.L));
}(this, function (exports,L) { 'use strict';

	L = 'default' in L ? L['default'] : L;

	var version = "0.3.4";

	/*
	 * Copyright 2015 Esri
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the Liscense.
	 */

	// checks if 2 x,y points are equal
	function pointsEqual (a, b) {
	  for (var i = 0; i < a.length; i++) {
	    if (a[i] !== b[i]) {
	      return false;
	    }
	  }
	  return true;
	}

	// checks if the first and last points of a ring are equal and closes the ring
	function closeRing (coordinates) {
	  if (!pointsEqual(coordinates[0], coordinates[coordinates.length - 1])) {
	    coordinates.push(coordinates[0]);
	  }
	  return coordinates;
	}

	// determine if polygon ring coordinates are clockwise. clockwise signifies outer ring, counter-clockwise an inner ring
	// or hole. this logic was found at http://stackoverflow.com/questions/1165647/how-to-determine-if-a-list-of-polygon-
	// points-are-in-clockwise-order
	function ringIsClockwise (ringToTest) {
	  var total = 0;
	  var i = 0;
	  var rLength = ringToTest.length;
	  var pt1 = ringToTest[i];
	  var pt2;
	  for (i; i < rLength - 1; i++) {
	    pt2 = ringToTest[i + 1];
	    total += (pt2[0] - pt1[0]) * (pt2[1] + pt1[1]);
	    pt1 = pt2;
	  }
	  return (total >= 0);
	}

	// ported from terraformer.js https://github.com/Esri/Terraformer/blob/master/terraformer.js#L504-L519
	function vertexIntersectsVertex (a1, a2, b1, b2) {
	  var uaT = (b2[0] - b1[0]) * (a1[1] - b1[1]) - (b2[1] - b1[1]) * (a1[0] - b1[0]);
	  var ubT = (a2[0] - a1[0]) * (a1[1] - b1[1]) - (a2[1] - a1[1]) * (a1[0] - b1[0]);
	  var uB = (b2[1] - b1[1]) * (a2[0] - a1[0]) - (b2[0] - b1[0]) * (a2[1] - a1[1]);

	  if (uB !== 0) {
	    var ua = uaT / uB;
	    var ub = ubT / uB;

	    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
	      return true;
	    }
	  }

	  return false;
	}

	// ported from terraformer.js https://github.com/Esri/Terraformer/blob/master/terraformer.js#L521-L531
	function arrayIntersectsArray (a, b) {
	  for (var i = 0; i < a.length - 1; i++) {
	    for (var j = 0; j < b.length - 1; j++) {
	      if (vertexIntersectsVertex(a[i], a[i + 1], b[j], b[j + 1])) {
	        return true;
	      }
	    }
	  }

	  return false;
	}

	// ported from terraformer.js https://github.com/Esri/Terraformer/blob/master/terraformer.js#L470-L480
	function coordinatesContainPoint (coordinates, point) {
	  var contains = false;
	  for (var i = -1, l = coordinates.length, j = l - 1; ++i < l; j = i) {
	    if (((coordinates[i][1] <= point[1] && point[1] < coordinates[j][1]) ||
	         (coordinates[j][1] <= point[1] && point[1] < coordinates[i][1])) &&
	        (point[0] < (coordinates[j][0] - coordinates[i][0]) * (point[1] - coordinates[i][1]) / (coordinates[j][1] - coordinates[i][1]) + coordinates[i][0])) {
	      contains = !contains;
	    }
	  }
	  return contains;
	}

	// ported from terraformer-arcgis-parser.js https://github.com/Esri/terraformer-arcgis-parser/blob/master/terraformer-arcgis-parser.js#L106-L113
	function coordinatesContainCoordinates (outer, inner) {
	  var intersects = arrayIntersectsArray(outer, inner);
	  var contains = coordinatesContainPoint(outer, inner[0]);
	  if (!intersects && contains) {
	    return true;
	  }
	  return false;
	}

	// do any polygons in this array contain any other polygons in this array?
	// used for checking for holes in arcgis rings
	// ported from terraformer-arcgis-parser.js https://github.com/Esri/terraformer-arcgis-parser/blob/master/terraformer-arcgis-parser.js#L117-L172
	function convertRingsToGeoJSON (rings) {
	  var outerRings = [];
	  var holes = [];
	  var x; // iterator
	  var outerRing; // current outer ring being evaluated
	  var hole; // current hole being evaluated

	  // for each ring
	  for (var r = 0; r < rings.length; r++) {
	    var ring = closeRing(rings[r].slice(0));
	    if (ring.length < 4) {
	      continue;
	    }
	    // is this ring an outer ring? is it clockwise?
	    if (ringIsClockwise(ring)) {
	      var polygon = [ ring ];
	      outerRings.push(polygon); // push to outer rings
	    } else {
	      holes.push(ring); // counterclockwise push to holes
	    }
	  }

	  var uncontainedHoles = [];

	  // while there are holes left...
	  while (holes.length) {
	    // pop a hole off out stack
	    hole = holes.pop();

	    // loop over all outer rings and see if they contain our hole.
	    var contained = false;
	    for (x = outerRings.length - 1; x >= 0; x--) {
	      outerRing = outerRings[x][0];
	      if (coordinatesContainCoordinates(outerRing, hole)) {
	        // the hole is contained push it into our polygon
	        outerRings[x].push(hole);
	        contained = true;
	        break;
	      }
	    }

	    // ring is not contained in any outer ring
	    // sometimes this happens https://github.com/Esri/esri-leaflet/issues/320
	    if (!contained) {
	      uncontainedHoles.push(hole);
	    }
	  }

	  // if we couldn't match any holes using contains we can try intersects...
	  while (uncontainedHoles.length) {
	    // pop a hole off out stack
	    hole = uncontainedHoles.pop();

	    // loop over all outer rings and see if any intersect our hole.
	    var intersects = false;

	    for (x = outerRings.length - 1; x >= 0; x--) {
	      outerRing = outerRings[x][0];
	      if (arrayIntersectsArray(outerRing, hole)) {
	        // the hole is contained push it into our polygon
	        outerRings[x].push(hole);
	        intersects = true;
	        break;
	      }
	    }

	    if (!intersects) {
	      outerRings.push([hole.reverse()]);
	    }
	  }

	  if (outerRings.length === 1) {
	    return {
	      type: 'Polygon',
	      coordinates: outerRings[0]
	    };
	  } else {
	    return {
	      type: 'MultiPolygon',
	      coordinates: outerRings
	    };
	  }
	}

	// shallow object clone for feature properties and attributes
	// from http://jsperf.com/cloning-an-object/2
	function shallowClone (obj) {
	  var target = {};
	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      target[i] = obj[i];
	    }
	  }
	  return target;
	}

	function arcgisToGeoJSON (arcgis, idAttribute) {
	  var geojson = {};

	  if (typeof arcgis.x === 'number' && typeof arcgis.y === 'number') {
	    geojson.type = 'Point';
	    geojson.coordinates = [arcgis.x, arcgis.y];
	  }

	  if (arcgis.points) {
	    geojson.type = 'MultiPoint';
	    geojson.coordinates = arcgis.points.slice(0);
	  }

	  if (arcgis.paths) {
	    if (arcgis.paths.length === 1) {
	      geojson.type = 'LineString';
	      geojson.coordinates = arcgis.paths[0].slice(0);
	    } else {
	      geojson.type = 'MultiLineString';
	      geojson.coordinates = arcgis.paths.slice(0);
	    }
	  }

	  if (arcgis.rings) {
	    geojson = convertRingsToGeoJSON(arcgis.rings.slice(0));
	  }

	  if (arcgis.geometry || arcgis.attributes) {
	    geojson.type = 'Feature';
	    geojson.geometry = (arcgis.geometry) ? arcgisToGeoJSON(arcgis.geometry) : null;
	    geojson.properties = (arcgis.attributes) ? shallowClone(arcgis.attributes) : null;
	    if (arcgis.attributes) {
	      geojson.id = arcgis.attributes[idAttribute] || arcgis.attributes.OBJECTID || arcgis.attributes.FID;
	    }
	  }

	  return geojson;
	}

	var Symbol = L.Class.extend({
	  initialize: function (symbolJson, options) {
	    this._symbolJson = symbolJson;
	    this.val = null;
	    this._styles = {};
	    this._isDefault = false;
	    this._layerTransparency = 1;
	    if (options && options.layerTransparency) {
	      this._layerTransparency = 1 - (options.layerTransparency / 100.0);
	    }
	  },

	  // the geojson values returned are in points
	  pixelValue: function (pointValue) {
	    return pointValue * 1.333;
	  },

	  // color is an array [r,g,b,a]
	  colorValue: function (color) {
	    return 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
	  },

	  alphaValue: function (color) {
	    var alpha = color[3] / 255.0;
	    return alpha * this._layerTransparency;
	  },

	  getSize: function (feature, sizeInfo) {
	    var attr = feature.properties;
	    var field = sizeInfo.field;
	    var size = 0;
	    var featureValue = null;

	    if (field) {
	      featureValue = attr[field];
	      var minSize = sizeInfo.minSize;
	      var maxSize = sizeInfo.maxSize;
	      var minDataValue = sizeInfo.minDataValue;
	      var maxDataValue = sizeInfo.maxDataValue;
	      var featureRatio;
	      var normField = sizeInfo.normalizationField;
	      var normValue = attr ? parseFloat(attr[normField]) : undefined;

	      if (featureValue === null || (normField && ((isNaN(normValue) || normValue === 0)))) {
	        return null;
	      }

	      if (!isNaN(normValue)) {
	        featureValue /= normValue;
	      }

	      if (minSize !== null && maxSize !== null && minDataValue !== null && maxDataValue !== null) {
	        if (featureValue <= minDataValue) {
	          size = minSize;
	        } else if (featureValue >= maxDataValue) {
	          size = maxSize;
	        } else {
	          featureRatio = (featureValue - minDataValue) / (maxDataValue - minDataValue);
	          size = minSize + (featureRatio * (maxSize - minSize));
	        }
	      }
	      size = isNaN(size) ? 0 : size;
	    }
	    return size;
	  },

	  getColor: function (feature, colorInfo) {
	    // required information to get color
	    if (!(feature.properties && colorInfo && colorInfo.field && colorInfo.stops)) {
	      return null;
	    }

	    var attr = feature.properties;
	    var featureValue = attr[colorInfo.field];
	    var lowerBoundColor, upperBoundColor, lowerBound, upperBound;
	    var normField = colorInfo.normalizationField;
	    var normValue = attr ? parseFloat(attr[normField]) : undefined;
	    if (featureValue === null || (normField && ((isNaN(normValue) || normValue === 0)))) {
	      return null;
	    }

	    if (!isNaN(normValue)) {
	      featureValue /= normValue;
	    }

	    if (featureValue <= colorInfo.stops[0].value) {
	      return colorInfo.stops[0].color;
	    }
	    var lastStop = colorInfo.stops[colorInfo.stops.length - 1];
	    if (featureValue >= lastStop.value) {
	      return lastStop.color;
	    }

	    // go through the stops to find min and max
	    for (var i = 0; i < colorInfo.stops.length; i++) {
	      var stopInfo = colorInfo.stops[i];

	      if (stopInfo.value <= featureValue) {
	        lowerBoundColor = stopInfo.color;
	        lowerBound = stopInfo.value;
	      } else if (stopInfo.value > featureValue) {
	        upperBoundColor = stopInfo.color;
	        upperBound = stopInfo.value;
	        break;
	      }
	    }

	    // feature falls between two stops, interplate the colors
	    if (!isNaN(lowerBound) && !isNaN(upperBound)) {
	      var range = upperBound - lowerBound;
	      if (range > 0) {
	        // more weight the further it is from the lower bound
	        var upperBoundColorWeight = (featureValue - lowerBound) / range;
	        if (upperBoundColorWeight) {
	          // more weight the further it is from the upper bound
	          var lowerBoundColorWeight = (upperBound - featureValue) / range;
	          if (lowerBoundColorWeight) {
	            // interpolate the lower and upper bound color by applying the
	            // weights to each of the rgba colors and adding them together
	            var interpolatedColor = [];
	            for (var j = 0; j < 4; j++) {
	              interpolatedColor[j] = Math.round(lowerBoundColor[j] * lowerBoundColorWeight + upperBoundColor[j] * upperBoundColorWeight);
	            }
	            return interpolatedColor;
	          } else {
	            // no difference between featureValue and upperBound, 100% of upperBoundColor
	            return upperBoundColor;
	          }
	        } else {
	          // no difference between featureValue and lowerBound, 100% of lowerBoundColor
	          return lowerBoundColor;
	        }
	      }
	    }
	    // if we get to here, none of the cases apply so return null
	    return null;
	  }
	});

	var ShapeMarker = L.Path.extend({

	  initialize: function (latlng, size, options) {
	    L.setOptions(this, options);
	    this._size = size;
	    this._latlng = L.latLng(latlng);
	    this._svgCanvasIncludes();
	  },

	  toGeoJSON: function () {
	    return L.GeoJSON.getFeature(this, {
	      type: 'Point',
	      coordinates: L.GeoJSON.latLngToCoords(this.getLatLng())
	    });
	  },

	  _svgCanvasIncludes: function () {
	    // implement in sub class
	  },

	  _project: function () {
	    this._point = this._map.latLngToLayerPoint(this._latlng);
	  },

	  _update: function () {
	    if (this._map) {
	      this._updatePath();
	    }
	  },

	  _updatePath: function () {
	    // implement in sub class
	  },

	  setLatLng: function (latlng) {
	    this._latlng = L.latLng(latlng);
	    this.redraw();
	    return this.fire('move', {latlng: this._latlng});
	  },

	  getLatLng: function () {
	    return this._latlng;
	  },

	  setSize: function (size) {
	    this._size = size;
	    return this.redraw();
	  },

	  getSize: function () {
	    return this._size;
	  }
	});

	var CrossMarker = ShapeMarker.extend({

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateCrossMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateCrossMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();
	        ctx.moveTo(latlng.x, latlng.y + offset);
	        ctx.lineTo(latlng.x, latlng.y - offset);
	        this._fillStroke(ctx, layer);

	        ctx.moveTo(latlng.x - offset, latlng.y);
	        ctx.lineTo(latlng.x + offset, latlng.y);
	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateCrossMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + latlng.x + ',' + (latlng.y + offset) +
	          'L' + latlng.x + ',' + (latlng.y - offset) +
	          'M' + (latlng.x - offset) + ',' + latlng.y +
	          'L' + (latlng.x + offset) + ',' + latlng.y;

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var crossMarker = function (latlng, size, options) {
	  return new CrossMarker(latlng, size, options);
	};

	var XMarker = ShapeMarker.extend({

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateXMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateXMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();

	        ctx.moveTo(latlng.x + offset, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y - offset);
	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateXMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + (latlng.x + offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + (latlng.y - offset) +
	          'M' + (latlng.x - offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x + offset) + ',' + (latlng.y - offset);

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var xMarker = function (latlng, size, options) {
	  return new XMarker(latlng, size, options);
	};

	var SquareMarker = ShapeMarker.extend({
	  options: {
	    fill: true
	  },

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateSquareMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateSquareMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();

	        ctx.moveTo(latlng.x + offset, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y - offset);
	        ctx.lineTo(latlng.x + offset, latlng.y - offset);

	        ctx.closePath();

	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateSquareMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + (latlng.x + offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + (latlng.y - offset) +
	          'L' + (latlng.x + offset) + ',' + (latlng.y - offset);

	        str = str + (L.Browser.svg ? 'z' : 'x');

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var squareMarker = function (latlng, size, options) {
	  return new SquareMarker(latlng, size, options);
	};

	var DiamondMarker = ShapeMarker.extend({
	  options: {
	    fill: true
	  },

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateDiamondMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateDiamondMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();

	        ctx.moveTo(latlng.x, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y);
	        ctx.lineTo(latlng.x, latlng.y - offset);
	        ctx.lineTo(latlng.x + offset, latlng.y);

	        ctx.closePath();

	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateDiamondMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + latlng.x + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + latlng.y +
	          'L' + latlng.x + ',' + (latlng.y - offset) +
	          'L' + (latlng.x + offset) + ',' + latlng.y;

	        str = str + (L.Browser.svg ? 'z' : 'x');

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var diamondMarker = function (latlng, size, options) {
	  return new DiamondMarker(latlng, size, options);
	};

	var PointSymbol = Symbol.extend({

	  statics: {
	    MARKERTYPES: ['esriSMSCircle', 'esriSMSCross', 'esriSMSDiamond', 'esriSMSSquare', 'esriSMSX', 'esriPMS']
	  },

	  initialize: function (symbolJson, options) {
	    Symbol.prototype.initialize.call(this, symbolJson, options);
	    if (options) {
	      this.serviceUrl = options.url;
	    }
	    if (symbolJson) {
	      if (symbolJson.type === 'esriPMS') {
	        var url = this.serviceUrl + 'images/' + this._symbolJson.url;
	        this._iconUrl = options && options.token ? url + '?token=' + options.token : url;
	        if (symbolJson.imageData) {
	          this._iconUrl = 'data:' + symbolJson.contentType + ';base64,' + symbolJson.imageData;
	        }
	        // leaflet does not allow resizing icons so keep a hash of different
	        // icon sizes to try and keep down on the number of icons created
	        this._icons = {};
	        // create base icon
	        this.icon = this._createIcon(this._symbolJson);
	      } else {
	        this._fillStyles();
	      }
	    }
	  },

	  _fillStyles: function () {
	    if (this._symbolJson.outline && this._symbolJson.size > 0) {
	      this._styles.stroke = true;
	      this._styles.weight = this.pixelValue(this._symbolJson.outline.width);
	      this._styles.color = this.colorValue(this._symbolJson.outline.color);
	      this._styles.opacity = this.alphaValue(this._symbolJson.outline.color);
	    } else {
	      this._styles.stroke = false;
	    }
	    if (this._symbolJson.color) {
	      this._styles.fillColor = this.colorValue(this._symbolJson.color);
	      this._styles.fillOpacity = this.alphaValue(this._symbolJson.color);
	    } else {
	      this._styles.fillOpacity = 0;
	    }

	    if (this._symbolJson.style === 'esriSMSCircle') {
	      this._styles.radius = this.pixelValue(this._symbolJson.size) / 2.0;
	    }
	  },

	  _createIcon: function (options) {
	    var width = this.pixelValue(options.width);
	    var height = width;
	    if (options.height) {
	      height = this.pixelValue(options.height);
	    }
	    var xOffset = width / 2.0;
	    var yOffset = height / 2.0;

	    if (options.xoffset) {
	      xOffset += this.pixelValue(options.xoffset);
	    }
	    if (options.yoffset) {
	      yOffset += this.pixelValue(options.yoffset);
	    }

	    var icon = L.icon({
	      iconUrl: this._iconUrl,
	      iconSize: [width, height],
	      iconAnchor: [xOffset, yOffset]
	    });
	    this._icons[options.width.toString()] = icon;
	    return icon;
	  },

	  _getIcon: function (size) {
	    // check to see if it is already created by size
	    var icon = this._icons[size.toString()];
	    if (!icon) {
	      icon = this._createIcon({width: size});
	    }
	    return icon;
	  },

	  pointToLayer: function (geojson, latlng, visualVariables, options) {
	    var size = this._symbolJson.size || this._symbolJson.width;
	    if (!this._isDefault) {
	      if (visualVariables.sizeInfo) {
	        var calculatedSize = this.getSize(geojson, visualVariables.sizeInfo);
	        if (calculatedSize) {
	          size = calculatedSize;
	        }
	      }
	      if (visualVariables.colorInfo) {
	        var color = this.getColor(geojson, visualVariables.colorInfo);
	        if (color) {
	          this._styles.fillColor = this.colorValue(color);
	          this._styles.fillOpacity = this.alphaValue(color);
	        }
	      }
	    }

	    if (this._symbolJson.type === 'esriPMS') {
	      var layerOptions = L.extend({}, {icon: this._getIcon(size)}, options);
	      return L.marker(latlng, layerOptions);
	    }
	    size = this.pixelValue(size);

	    switch (this._symbolJson.style) {
	      case 'esriSMSSquare':
	        return squareMarker(latlng, size, L.extend({}, this._styles, options));
	      case 'esriSMSDiamond':
	        return diamondMarker(latlng, size, L.extend({}, this._styles, options));
	      case 'esriSMSCross':
	        return crossMarker(latlng, size, L.extend({}, this._styles, options));
	      case 'esriSMSX':
	        return xMarker(latlng, size, L.extend({}, this._styles, options));
	    }
	    this._styles.radius = size / 2.0;
	    return L.circleMarker(latlng, L.extend({}, this._styles, options));
	  }
	});

	function pointSymbol (symbolJson, options) {
	  return new PointSymbol(symbolJson, options);
	}

	var LineSymbol = Symbol.extend({
	  statics: {
	    // Not implemented 'esriSLSNull'
	    LINETYPES: ['esriSLSDash', 'esriSLSDot', 'esriSLSDashDotDot', 'esriSLSDashDot', 'esriSLSSolid']
	  },
	  initialize: function (symbolJson, options) {
	    Symbol.prototype.initialize.call(this, symbolJson, options);
	    this._fillStyles();
	  },

	  _fillStyles: function () {
	    // set the defaults that show up on arcgis online
	    this._styles.lineCap = 'butt';
	    this._styles.lineJoin = 'miter';
	    this._styles.fill = false;
	    this._styles.weight = 0;

	    if (!this._symbolJson) {
	      return this._styles;
	    }

	    if (this._symbolJson.color) {
	      this._styles.color = this.colorValue(this._symbolJson.color);
	      this._styles.opacity = this.alphaValue(this._symbolJson.color);
	    }

	    if (!isNaN(this._symbolJson.width)) {
	      this._styles.weight = this.pixelValue(this._symbolJson.width);

	      var dashValues = [];

	      switch (this._symbolJson.style) {
	        case 'esriSLSDash':
	          dashValues = [4, 3];
	          break;
	        case 'esriSLSDot':
	          dashValues = [1, 3];
	          break;
	        case 'esriSLSDashDot':
	          dashValues = [8, 3, 1, 3];
	          break;
	        case 'esriSLSDashDotDot':
	          dashValues = [8, 3, 1, 3, 1, 3];
	          break;
	      }

	      // use the dash values and the line weight to set dash array
	      if (dashValues.length > 0) {
	        for (var i = 0; i < dashValues.length; i++) {
	          dashValues[i] *= this._styles.weight;
	        }

	        this._styles.dashArray = dashValues.join(',');
	      }
	    }
	  },

	  style: function (feature, visualVariables) {
	    if (!this._isDefault && visualVariables) {
	      if (visualVariables.sizeInfo) {
	        var calculatedSize = this.pixelValue(this.getSize(feature, visualVariables.sizeInfo));
	        if (calculatedSize) {
	          this._styles.weight = calculatedSize;
	        }
	      }
	      if (visualVariables.colorInfo) {
	        var color = this.getColor(feature, visualVariables.colorInfo);
	        if (color) {
	          this._styles.color = this.colorValue(color);
	          this._styles.opacity = this.alphaValue(color);
	        }
	      }
	    }
	    return this._styles;
	  }
	});

	function lineSymbol (symbolJson, options) {
	  return new LineSymbol(symbolJson, options);
	}

	var PolygonSymbol = Symbol.extend({
	  statics: {
	    // not implemented: 'esriSFSBackwardDiagonal','esriSFSCross','esriSFSDiagonalCross','esriSFSForwardDiagonal','esriSFSHorizontal','esriSFSNull','esriSFSVertical'
	    POLYGONTYPES: ['esriSFSSolid']
	  },
	  initialize: function (symbolJson, options) {
	    Symbol.prototype.initialize.call(this, symbolJson, options);
	    if (symbolJson) {
	      this._lineStyles = lineSymbol(symbolJson.outline, options).style();
	      this._fillStyles();
	    }
	  },

	  _fillStyles: function () {
	    if (this._lineStyles) {
	      if (this._lineStyles.weight === 0) {
	        // when weight is 0, setting the stroke to false can still look bad
	        // (gaps between the polygons)
	        this._styles.stroke = false;
	      } else {
	        // copy the line symbol styles into this symbol's styles
	        for (var styleAttr in this._lineStyles) {
	          this._styles[styleAttr] = this._lineStyles[styleAttr];
	        }
	      }
	    }

	    // set the fill for the polygon
	    if (this._symbolJson) {
	      if (this._symbolJson.color &&
	          // don't fill polygon if type is not supported
	          PolygonSymbol.POLYGONTYPES.indexOf(this._symbolJson.style >= 0)) {
	        this._styles.fill = true;
	        this._styles.fillColor = this.colorValue(this._symbolJson.color);
	        this._styles.fillOpacity = this.alphaValue(this._symbolJson.color);
	      } else {
	        this._styles.fill = false;
	        this._styles.fillOpacity = 0;
	      }
	    }
	  },

	  style: function (feature, visualVariables) {
	    if (!this._isDefault && visualVariables && visualVariables.colorInfo) {
	      var color = this.getColor(feature, visualVariables.colorInfo);
	      if (color) {
	        this._styles.fillColor = this.colorValue(color);
	        this._styles.fillOpacity = this.alphaValue(color);
	      }
	    }
	    return this._styles;
	  }
	});

	function polygonSymbol (symbolJson, options) {
	  return new PolygonSymbol(symbolJson, options);
	}

	var Renderer = L.Class.extend({
	  options: {
	    proportionalPolygon: false,
	    clickable: true
	  },

	  initialize: function (rendererJson, options) {
	    this._rendererJson = rendererJson;
	    this._pointSymbols = false;
	    this._symbols = [];
	    this._visualVariables = this._parseVisualVariables(rendererJson.visualVariables);
	    L.Util.setOptions(this, options);
	  },

	  _parseVisualVariables: function (visualVariables) {
	    var visVars = {};
	    if (visualVariables) {
	      for (var i = 0; i < visualVariables.length; i++) {
	        visVars[visualVariables[i].type] = visualVariables[i];
	      }
	    }
	    return visVars;
	  },

	  _createDefaultSymbol: function () {
	    if (this._rendererJson.defaultSymbol) {
	      this._defaultSymbol = this._newSymbol(this._rendererJson.defaultSymbol);
	      this._defaultSymbol._isDefault = true;
	    }
	  },

	  _newSymbol: function (symbolJson) {
	    if (symbolJson.type === 'esriSMS' || symbolJson.type === 'esriPMS') {
	      this._pointSymbols = true;
	      return pointSymbol(symbolJson, this.options);
	    }
	    if (symbolJson.type === 'esriSLS') {
	      return lineSymbol(symbolJson, this.options);
	    }
	    if (symbolJson.type === 'esriSFS') {
	      return polygonSymbol(symbolJson, this.options);
	    }
	  },

	  _getSymbol: function () {
	    // override
	  },

	  attachStylesToLayer: function (layer) {
	    if (this._pointSymbols) {
	      layer.options.pointToLayer = L.Util.bind(this.pointToLayer, this);
	    } else {
	      layer.options.style = L.Util.bind(this.style, this);
	      layer._originalStyle = layer.options.style;
	    }
	  },

	  pointToLayer: function (geojson, latlng) {
	    var sym = this._getSymbol(geojson);
	    if (sym && sym.pointToLayer) {
	      // right now custom panes are the only option pushed through
	      return sym.pointToLayer(geojson, latlng, this._visualVariables, this.options);
	    }
	    // invisible symbology
	    return L.circleMarker(latlng, {radius: 0, opacity: 0});
	  },

	  style: function (feature) {
	    var userStyles;
	    if (this.options.userDefinedStyle) {
	      userStyles = this.options.userDefinedStyle(feature);
	    }
	    // find the symbol to represent this feature
	    var sym = this._getSymbol(feature);
	    if (sym) {
	      return this.mergeStyles(sym.style(feature, this._visualVariables), userStyles);
	    } else {
	      // invisible symbology
	      return this.mergeStyles({opacity: 0, fillOpacity: 0}, userStyles);
	    }
	  },

	  mergeStyles: function (styles, userStyles) {
	    var mergedStyles = {};
	    var attr;
	    // copy renderer style attributes
	    for (attr in styles) {
	      if (styles.hasOwnProperty(attr)) {
	        mergedStyles[attr] = styles[attr];
	      }
	    }
	    // override with user defined style attributes
	    if (userStyles) {
	      for (attr in userStyles) {
	        if (userStyles.hasOwnProperty(attr)) {
	          mergedStyles[attr] = userStyles[attr];
	        }
	      }
	    }
	    return mergedStyles;
	  }
	});

	var ClassBreaksRenderer = Renderer.extend({
	  initialize: function (rendererJson, options) {
	    Renderer.prototype.initialize.call(this, rendererJson, options);
	    this._field = this._rendererJson.field;
	    if (this._rendererJson.normalizationType && this._rendererJson.normalizationType === 'esriNormalizeByField') {
	      this._normalizationField = this._rendererJson.normalizationField;
	    }
	    this._createSymbols();
	  },

	  _createSymbols: function () {
	    var symbol;
	    var classbreaks = this._rendererJson.classBreakInfos;

	    this._symbols = [];

	    // create a symbol for each class break
	    for (var i = classbreaks.length - 1; i >= 0; i--) {
	      if (this.options.proportionalPolygon && this._rendererJson.backgroundFillSymbol) {
	        symbol = this._newSymbol(this._rendererJson.backgroundFillSymbol);
	      } else {
	        symbol = this._newSymbol(classbreaks[i].symbol);
	      }
	      symbol.val = classbreaks[i].classMaxValue;
	      this._symbols.push(symbol);
	    }
	    // sort the symbols in ascending value
	    this._symbols.sort(function (a, b) {
	      return a.val > b.val ? 1 : -1;
	    });
	    this._createDefaultSymbol();
	    this._maxValue = this._symbols[this._symbols.length - 1].val;
	  },

	  _getSymbol: function (feature) {
	    var val = feature.properties[this._field];
	    if (this._normalizationField) {
	      var normValue = feature.properties[this._normalizationField];
	      if (!isNaN(normValue) && normValue !== 0) {
	        val = val / normValue;
	      } else {
	        return this._defaultSymbol;
	      }
	    }

	    if (val > this._maxValue) {
	      return this._defaultSymbol;
	    }
	    var symbol = this._symbols[0];
	    for (var i = this._symbols.length - 1; i >= 0; i--) {
	      if (val > this._symbols[i].val) {
	        break;
	      }
	      symbol = this._symbols[i];
	    }
	    return symbol;
	  }
	});

	function classBreaksRenderer (rendererJson, options) {
	  return new ClassBreaksRenderer(rendererJson, options);
	}

	var UniqueValueRenderer = Renderer.extend({
	  initialize: function (rendererJson, options) {
	    Renderer.prototype.initialize.call(this, rendererJson, options);
	    this._field = this._rendererJson.field1;
	    this._createSymbols();
	  },

	  _createSymbols: function () {
	    var symbol;
	    var uniques = this._rendererJson.uniqueValueInfos;

	    // create a symbol for each unique value
	    for (var i = uniques.length - 1; i >= 0; i--) {
	      symbol = this._newSymbol(uniques[i].symbol);
	      symbol.val = uniques[i].value;
	      this._symbols.push(symbol);
	    }
	    this._createDefaultSymbol();
	  },

	  _getSymbol: function (feature) {
	    var val = feature.properties[this._field];
	    // accumulate values if there is more than one field defined
	    if (this._rendererJson.fieldDelimiter && this._rendererJson.field2) {
	      var val2 = feature.properties[this._rendererJson.field2];
	      if (val2) {
	        val += this._rendererJson.fieldDelimiter + val2;
	        var val3 = feature.properties[this._rendererJson.field3];
	        if (val3) {
	          val += this._rendererJson.fieldDelimiter + val3;
	        }
	      }
	    }

	    var symbol = this._defaultSymbol;
	    for (var i = this._symbols.length - 1; i >= 0; i--) {
	      // using the === operator does not work if the field
	      // of the unique renderer is not a string
	      /*eslint-disable */
	      if (this._symbols[i].val == val) {
	        symbol = this._symbols[i];
	      }
	      /*eslint-enable */
	    }
	    return symbol;
	  }
	});

	function uniqueValueRenderer (rendererJson, options) {
	  return new UniqueValueRenderer(rendererJson, options);
	}

	var SimpleRenderer = Renderer.extend({
	  initialize: function (rendererJson, options) {
	    Renderer.prototype.initialize.call(this, rendererJson, options);
	    this._createSymbol();
	  },

	  _createSymbol: function () {
	    if (this._rendererJson.symbol) {
	      this._symbols.push(this._newSymbol(this._rendererJson.symbol));
	    }
	  },

	  _getSymbol: function () {
	    return this._symbols[0];
	  }
	});

	function simpleRenderer (rendererJson, options) {
	  return new SimpleRenderer(rendererJson, options);
	}

	var FeatureCollection = L.GeoJSON.extend({
	  options: {
	    data: {}, // Esri Feature Collection JSON or Item ID
	    opacity: 1,
	    renderer: {}
	  },

	  initialize: function (layers, options) {
	    L.setOptions(this, options);

	    this.data = this.options.data;
	    this.opacity = this.options.opacity;
	    this.renderer = this.options.renderer;
	    this._layers = {};

	    var i, len;

	    if (layers) {
	      for (i = 0, len = layers.length; i < len; i++) {
	        this.addLayer(layers[i]);
	      }
	    }

	    if (typeof this.data === 'string') {
	      this._getFeatureCollection(this.data);
	    } else {
	      this._parseFeatureCollection(this.data);
	    }
	  },

	  _getFeatureCollection: function (itemId) {
	    var url = 'https://www.arcgis.com/sharing/rest/content/items/' + itemId + '/data';
	    L.esri.request(url, {}, function (err, res) {
	      if (err) {
	        console.log(err);
	      } else {
	        this._parseFeatureCollection(res);
	      }
	    }, this);
	  },

	  _parseFeatureCollection: function (data) {
	    var features = data.layers[0].featureSet.features;
	    var geometryType = data.layers[0].layerDefinition.geometryType; // 'esriGeometryPoint' | 'esriGeometryMultipoint' | 'esriGeometryPolyline' | 'esriGeometryPolygon' | 'esriGeometryEnvelope'
	    var objectIdField = data.layers[0].layerDefinition.objectIdField;

	    if (data.layers[0].layerDefinition.extent.spatialReference.wkid === 102100) {
	      features = this._projTo4326(features, geometryType);
	    }

	    var geojson = this._featureCollectionToGeoJSON(features, objectIdField);

	    this._setRenderers(data.layers[0].layerDefinition);
	    console.log(geojson);
	    this.addData(geojson);
	  },

	  _projTo4326: function (features, geometryType) {
	    console.log('_project!');
	    var i, len;
	    var projFeatures = [];

	    for (i = 0, len = features.length; i < len; i++) {
	      var f = features[i];
	      var mercatorToLatlng;
	      var j, k;

	      if (geometryType === 'esriGeometryPoint') {
	        mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.x, f.geometry.y));
	        f.geometry.x = mercatorToLatlng.lng;
	        f.geometry.y = mercatorToLatlng.lat;
	      } else if (geometryType === 'esriGeometryMultipoint') {
	        var plen;

	        for (j = 0, plen = f.geometry.points.length; j < plen; j++) {
	          mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.points[j][0], f.geometry.points[j][1]));
	          f.geometry.points[j][0] = mercatorToLatlng.lng;
	          f.geometry.points[j][1] = mercatorToLatlng.lat;
	        }
	      } else if (geometryType === 'esriGeometryPolyline') {
	        var pathlen, pathslen;

	        for (j = 0, pathslen = f.geometry.paths.length; j < pathslen; j++) {
	          for (k = 0, pathlen = f.geometry.paths[j].length; k < pathlen; k++) {
	            mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.paths[j][k][0], f.geometry.paths[j][k][1]));
	            f.geometry.paths[j][k][0] = mercatorToLatlng.lng;
	            f.geometry.paths[j][k][1] = mercatorToLatlng.lat;
	          }
	        }
	      } else if (geometryType === 'esriGeometryPolygon') {
	        var ringlen, ringslen;

	        for (j = 0, ringslen = f.geometry.rings.length; j < ringslen; j++) {
	          for (k = 0, ringlen = f.geometry.rings[j].length; k < ringlen; k++) {
	            mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.rings[j][k][0], f.geometry.rings[j][k][1]));
	            f.geometry.rings[j][k][0] = mercatorToLatlng.lng;
	            f.geometry.rings[j][k][1] = mercatorToLatlng.lat;
	          }
	        }
	      }
	      projFeatures.push(f);
	    }

	    return projFeatures;
	  },

	  _featureCollectionToGeoJSON: function (features, objectIdField) {
	    var geojsonFeatureCollection = {
	      type: 'FeatureCollection',
	      features: []
	    };
	    var featuresArray = [];
	    var i, len;

	    for (i = 0, len = features.length; i < len; i++) {
	      var geojson = arcgisToGeoJSON(features[i], objectIdField);
	      featuresArray.push(geojson);
	    }

	    geojsonFeatureCollection.features = featuresArray;

	    return geojsonFeatureCollection;
	  },

	  _checkForProportionalSymbols: function (geometryType, renderer) {
	    this._hasProportionalSymbols = false;
	    if (geometryType === 'esriGeometryPolygon') {
	      if (renderer.backgroundFillSymbol) {
	        this._hasProportionalSymbols = true;
	      }
	      // check to see if the first symbol in the classbreaks is a marker symbol
	      if (renderer.classBreakInfos && renderer.classBreakInfos.length) {
	        var sym = renderer.classBreakInfos[0].symbol;
	        if (sym && (sym.type === 'esriSMS' || sym.type === 'esriPMS')) {
	          this._hasProportionalSymbols = true;
	        }
	      }
	    }
	  },

	  _setRenderers: function (layerDefinition) {
	    var rend;
	    var rendererInfo = this.renderer;

	    var options = {};

	    if (this.options.pane) {
	      options.pane = this.options.pane;
	    }
	    if (layerDefinition.drawingInfo.transparency) {
	      options.layerTransparency = layerDefinition.drawingInfo.transparency;
	    }
	    if (this.options.style) {
	      options.userDefinedStyle = this.options.style;
	    }

	    switch (rendererInfo.type) {
	      case 'classBreaks':
	        this._checkForProportionalSymbols(layerDefinition.geometryType, rendererInfo);
	        if (this._hasProportionalSymbols) {
	          this._createPointLayer();
	          var pRend = classBreaksRenderer(rendererInfo, options);
	          pRend.attachStylesToLayer(this._pointLayer);
	          options.proportionalPolygon = true;
	        }
	        rend = classBreaksRenderer(rendererInfo, options);
	        break;
	      case 'uniqueValue':
	        console.log(rendererInfo, options);
	        rend = uniqueValueRenderer(rendererInfo, options);
	        break;
	      default:
	        rend = simpleRenderer(rendererInfo, options);
	    }
	    rend.attachStylesToLayer(this);
	  }
	});

	function featureCollection (geojson, options) {
	  return new FeatureCollection(geojson, options);
	}

	var LabelIcon = L.DivIcon.extend({
	  options: {
	    iconSize: null,
	    className: 'esri-leaflet-webmap-labels',
	    text: ''
	  },

	  createIcon: function (oldIcon) {
	    var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div');
	    var options = this.options;

	    div.innerHTML = '<div style="position: relative; left: -50%; text-shadow: 1px 1px 0px #fff, -1px 1px 0px #fff, 1px -1px 0px #fff, -1px -1px 0px #fff;">' + options.text + '</div>';

	    // label.css
	    div.style.fontSize = '1em';
	    div.style.fontWeight = 'bold';
	    div.style.textTransform = 'uppercase';
	    div.style.textAlign = 'center';
	    div.style.whiteSpace = 'nowrap';

	    if (options.bgPos) {
	      var bgPos = L.point(options.bgPos);
	      div.style.backgroundPosition = (-bgPos.x) + 'px ' + (-bgPos.y) + 'px';
	    }
	    this._setIconStyles(div, 'icon');

	    return div;
	  }
	});

	function labelIcon (options) {
	  return new LabelIcon(options);
	}

	var LabelMarker = L.Marker.extend({
	  options: {
	    properties: {},
	    labelingInfo: {},
	    offset: [0, 0]
	  },

	  initialize: function (latlng, options) {
	    L.setOptions(this, options);
	    this._latlng = L.latLng(latlng);

	    var labelText = this._createLabelText(this.options.properties, this.options.labelingInfo);
	    this._setLabelIcon(labelText, this.options.offset);
	  },

	  _createLabelText: function (properties, labelingInfo) {
	    var r = /\[([^\]]*)\]/g;
	    var labelText = labelingInfo[0].labelExpression;

	    labelText = labelText.replace(r, function (s) {
	      var m = r.exec(s);
	      return properties[m[1]];
	    });

	    return labelText;
	  },

	  _setLabelIcon: function (text, offset) {
	    var icon = labelIcon({
	      text: text,
	      iconAnchor: offset
	    });

	    this.setIcon(icon);
	  }
	});

	function labelMarker (latlng, options) {
	  return new LabelMarker(latlng, options);
	}

	function pointLabelPos (coordinates) {
	  var labelPos = { position: [], offset: [] };

	  labelPos.position = coordinates.reverse();
	  labelPos.offset = [20, 20];

	  return labelPos;
	}

	function polylineLabelPos (coordinates) {
	  var labelPos = { position: [], offset: [] };
	  var centralKey;

	  centralKey = Math.round(coordinates.length / 2);
	  labelPos.position = coordinates[centralKey].reverse();
	  labelPos.offset = [0, 0];

	  return labelPos;
	}

	function polygonLabelPos (layer, coordinates) {
	  var labelPos = { position: [], offset: [] };

	  labelPos.position = layer.getBounds().getCenter();
	  labelPos.offset = [0, 0];

	  return labelPos;
	}

	function createPopupContent (popupInfo, properties) {
	  // console.log(popupInfo, properties);
	  var r = /\{([^\]]*)\}/g;
	  var titleText = '';
	  var content = '';

	  if (popupInfo.title !== undefined) {
	    titleText = popupInfo.title;
	  }

	  titleText = titleText.replace(r, function (s) {
	    var m = r.exec(s);
	    return properties[m[1]];
	  });

	  content = '<div class="leaflet-popup-content-title"><h4>' + titleText + '</h4></div><div class="leaflet-popup-content-description" style="max-height:200px;overflow:auto;">';

	  for (var i = 0; i < popupInfo.fieldInfos.length; i++) {
	    if (popupInfo.fieldInfos[i].visible === true) {
	      content += '<div style="font-weight:bold;color:#999;margin-top:5px;word-break:break-all;">' + popupInfo.fieldInfos[i].label + '</div><p style="margin-top:0;margin-bottom:5px;word-break:break-all;">' + properties[popupInfo.fieldInfos[i].fieldName] + '</p>';
	    }
	  }

	  content += '</div>';

	  if (popupInfo.mediaInfos.length > 0) {
	    // It does not support mediaInfos for popup contents.
	  }

	  return content;
	}

	function operationalLayer (layer, layers, map, paneName) {
	  return _generateEsriLayer(layer, layers, map, paneName);
	}

	function _generateEsriLayer (layer, layers, map, paneName) {
	  console.log('generateEsriLayer: ', layer.title, layer);
	  var lyr;
	  var labels = [];
	  var labelsLayer;
	  var labelPaneName = paneName + '-label';

	  if (layer.featureCollection !== undefined) {
	    console.log('create FeatureCollection');

	    map.createPane(labelPaneName);

	    labelsLayer = L.featureGroup(labels);
	    lyr = featureCollection([], {
	      data: layer.itemId || layer.featureCollection,
	      opacity: layer.opacity,
	      renderer: layer.featureCollection.layers[0].layerDefinition.drawingInfo.renderer,
	      pane: paneName,
	      onEachFeature: function (geojson, l) {
	        if (layer.featureCollection.layers[0].popupInfo !== undefined) {
	          var popupContent = createPopupContent(layer.featureCollection.layers[0].popupInfo, geojson.properties);
	          l.bindPopup(popupContent);
	        }
	        if (layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo !== undefined) {
	          var labelingInfo = layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo;
	          var coordinates = l.feature.geometry.coordinates;
	          var labelPos;

	          if (l.feature.geometry.type === 'Point') {
	            labelPos = pointLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'LineString') {
	            labelPos = polylineLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'MultiLineString') {
	            labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
	          } else {
	            labelPos = polygonLabelPos(l);
	          }

	          var label = labelMarker(labelPos.position, {
	            zIndexOffset: 1,
	            properties: geojson.properties,
	            labelingInfo: labelingInfo,
	            offset: labelPos.offset,
	            pane: labelPaneName
	          });

	          labelsLayer.addLayer(label);
	        }
	      }
	    });

	    lyr = L.layerGroup([lyr, labelsLayer]);

	    layers.push({ type: 'FC', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.type === 'Feature Collection') {
	    console.log('create FeatureCollection without featureCollection property');
	    lyr = featureCollection([], {
	      data: layer.itemId,
	      pane: paneName,
	      opacity: layer.opacity
	    });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition !== undefined) {
	    var where = '1=1';
	    if (layer.layerDefinition.drawingInfo !== undefined) {
	      if (layer.layerDefinition.drawingInfo.renderer.type === 'heatmap') {
	        console.log('create HeatmapLayer');
	        var gradient = {};

	        layer.layerDefinition.drawingInfo.renderer.colorStops.map(function (stop) {
	          // gradient[stop.ratio] = 'rgba(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ',' + (stop.color[3]/255) + ')';
	          // gradient[Math.round(stop.ratio*100)/100] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
	          gradient[(Math.round(stop.ratio * 100) / 100 + 6) / 7] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
	        });

	        lyr = L.esri.Heat.heatmapFeatureLayer({ // Esri Leaflet 2.0
	        // lyr = L.esri.heatmapFeatureLayer({ // Esri Leaflet 1.0
	          url: layer.url,
	          minOpacity: 0.5,
	          max: layer.layerDefinition.drawingInfo.renderer.maxPixelIntensity,
	          blur: layer.layerDefinition.drawingInfo.renderer.blurRadius,
	          radius: layer.layerDefinition.drawingInfo.renderer.blurRadius * 1.3,
	          gradient: gradient,
	          pane: paneName
	        });

	        layers.push({ type: 'HL', title: layer.title || '', layer: lyr });

	        return lyr;
	      } else {
	        console.log('create ArcGISFeatureLayer (with layerDefinition.drawingInfo)');
	        var drawingInfo = layer.layerDefinition.drawingInfo;
	        drawingInfo.transparency = 100 - (layer.opacity * 100);
	        console.log(drawingInfo.transparency);

	        if (layer.layerDefinition.definitionExpression !== undefined) {
	          where = layer.layerDefinition.definitionExpression;
	        }

	        map.createPane(labelPaneName);

	        labelsLayer = L.featureGroup(labels);

	        lyr = L.esri.featureLayer({
	          url: layer.url,
	          where: where,
	          drawingInfo: drawingInfo,
	          pane: paneName,
	          onEachFeature: function (geojson, l) {
	            if (layer.popupInfo !== undefined) {
	              var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	              l.bindPopup(popupContent);
	            }
	            if (layer.layerDefinition.drawingInfo.labelingInfo !== undefined) {
	              var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
	              var coordinates = l.feature.geometry.coordinates;
	              var labelPos;

	              if (l.feature.geometry.type === 'Point') {
	                labelPos = pointLabelPos(coordinates);
	              } else if (l.feature.geometry.type === 'LineString') {
	                labelPos = polylineLabelPos(coordinates);
	              } else if (l.feature.geometry.type === 'MultiLineString') {
	                labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
	              } else {
	                labelPos = polygonLabelPos(l);
	              }

	              var label = labelMarker(labelPos.position, {
	                zIndexOffset: 1,
	                properties: geojson.properties,
	                labelingInfo: labelingInfo,
	                offset: labelPos.offset,
	                pane: labelPaneName
	              });

	              labelsLayer.addLayer(label);
	            }
	          }
	        });

	        lyr = L.layerGroup([lyr, labelsLayer]);

	        layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	        return lyr;
	      }
	    } else {
	      console.log('create ArcGISFeatureLayer (without layerDefinition.drawingInfo)');

	      if (layer.layerDefinition.definitionExpression !== undefined) {
	        where = layer.layerDefinition.definitionExpression;
	      }

	      lyr = L.esri.featureLayer({
	        url: layer.url,
	        where: where,
	        pane: paneName,
	        onEachFeature: function (geojson, l) {
	          if (layer.popupInfo !== undefined) {
	            var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	            l.bindPopup(popupContent);
	          }
	        }
	      });

	      layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	      return lyr;
	    }
	  } else if (layer.layerType === 'ArcGISFeatureLayer') {
	    console.log('create ArcGISFeatureLayer');
	    lyr = L.esri.featureLayer({
	      url: layer.url,
	      pane: paneName,
	      onEachFeature: function (geojson, l) {
	        if (layer.popupInfo !== undefined) {
	          var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	          l.bindPopup(popupContent);
	        }
	      }
	    });

	    layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISImageServiceLayer') {
	    console.log('create ArcGISImageServiceLayer');
	    lyr = L.esri.imageMapLayer({
	      url: layer.url,
	      pane: paneName,
	      opacity: layer.opacity || 1
	    });

	    layers.push({ type: 'IML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISMapServiceLayer') {
	    lyr = L.esri.dynamicMapLayer({
	      url: layer.url,
	      pane: paneName,
	      opacity: layer.opacity || 1
	    });

	    layers.push({ type: 'DML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISTiledMapServiceLayer') {
	    try {
	      lyr = L.esri.basemapLayer(layer.title);
	    } catch (e) {
	      lyr = L.esri.tiledMapLayer({
	        url: layer.url
	      });

	      L.esri.request(layer.url, {}, function (err, res) {
	        if (err) {
	          console.log(err);
	        } else {
	          var maxWidth = (map.getSize().x - 55);
	          var tiledAttribution = '<span class="esri-attributions" style="line-height:14px; vertical-align: -3px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; display:inline-block; max-width:' + maxWidth + 'px;">' + res.copyrightText + '</span>';
	          map.attributionControl.addAttribution(tiledAttribution);
	        }
	      });
	    }

	    document.getElementsByClassName('leaflet-tile-pane')[0].style.opacity = layer.opacity || 1;

	    layers.push({ type: 'TML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'OpenStreetMap') {
	    lyr = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
	      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
	    });

	    layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'WebTiledLayer') {
	    var lyrUrl = _esriWTLUrlTemplateToLeaflet(layer.templateUrl);
	    lyr = L.tileLayer(lyrUrl, {
	      attribution: layer.copyright
	    });
	    document.getElementsByClassName('leaflet-tile-pane')[0].style.opacity = layer.opacity || 1;

	    layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

	    return lyr;
	  } else {
	    lyr = L.featureGroup([]);
	    console.log('Unsupported Layer: ', layer);
	    return lyr;
	  }
	}

	function _esriWTLUrlTemplateToLeaflet (url) {
	  var newUrl = url;

	  newUrl = newUrl.replace(/\{level}/g, '{z}');
	  newUrl = newUrl.replace(/\{col}/g, '{x}');
	  newUrl = newUrl.replace(/\{row}/g, '{y}');

	  return newUrl;
	}

	var WebMap = L.Evented.extend({
	  options: {
	    // L.Map
	    map: {},
	    // access token for secure contents on ArcGIS Online
	    token: null,
	    // server domain name (default= 'www.arcgis.com')
	    server: 'www.arcgis.com'
	  },

	  initialize: function (webmapId, options) {
	    L.setOptions(this, options);

	    this._map = this.options.map;
	    this._token = this.options.token;
	    this._server = this.options.server;
	    this._webmapId = webmapId;
	    this._loaded = false;
	    this._metadataLoaded = false;

	    this.layers = []; // Check the layer types here -> https://github.com/ynunokawa/L.esri.WebMap/wiki/Layer-types
	    this.title = ''; // Web Map Title
	    this.bookmarks = []; // Web Map Bookmarks -> [{ name: 'Bookmark name', bounds: <L.latLngBounds> }]
	    this.portalItem = {}; // Web Map Metadata

	    this.VERSION = version;

	    this._loadWebMapMetaData(webmapId);
	    this._loadWebMap(webmapId);
	  },

	  _loadWebMapMetaData: function (id) {
	    var params = {};
	    var map = this._map;
	    var webmap = this;
	    var webmapMetaDataRequestUrl = 'https://' + this._server + '/sharing/rest/content/items/' + id;
	    if (this._token && this._token.length > 0) {
	      params.token = this._token;
	    }

	    L.esri.request(webmapMetaDataRequestUrl, params, function (error, response) {
	      if (error) {
	        console.log(error);
	      } else {
	        console.log('WebMap MetaData: ', response);
	        webmap.portalItem = response;
	        webmap.title = response.title;
	        webmap._metadataLoaded = true;
	        webmap.fire('metadataLoad');
	        map.fitBounds([response.extent[0].reverse(), response.extent[1].reverse()]);
	      }
	    });
	  },

	  _loadWebMap: function (id) {
	    var map = this._map;
	    var layers = this.layers;
	    var params = {};
	    var webmapRequestUrl = 'https://' + this._server + '/sharing/rest/content/items/' + id + '/data';
	    if (this._token && this._token.length > 0) {
	      params.token = this._token;
	    }

	    L.esri.request(webmapRequestUrl, params, function (error, response) {
	      if (error) {
	        console.log(error);
	      } else {
	        console.log('WebMap: ', response);

	        // Add Basemap
	        response.baseMap.baseMapLayers.map(function (baseMapLayer) {
	          var lyr = operationalLayer(baseMapLayer, layers, map).addTo(map);
	          if (lyr !== undefined && baseMapLayer.visibility === true) {
	            lyr.addTo(map);
	          }
	        });

	        // Add Operational Layers
	        response.operationalLayers.map(function (layer, i) {
	          var paneName = 'esri-webmap-layer' + i;
	          map.createPane(paneName);
	          var lyr = operationalLayer(layer, layers, map, paneName);
	          if (lyr !== undefined && layer.visibility === true) {
	            lyr.addTo(map);
	          }
	        });

	        // Add Bookmarks
	        if (response.bookmarks !== undefined && response.bookmarks.length > 0) {
	          response.bookmarks.map(function (bookmark) {
	            // Esri Extent Geometry to L.latLngBounds
	            var northEast = L.Projection.SphericalMercator.unproject(L.point(bookmark.extent.xmax, bookmark.extent.ymax));
	            var southWest = L.Projection.SphericalMercator.unproject(L.point(bookmark.extent.xmin, bookmark.extent.ymin));
	            var bounds = L.latLngBounds(southWest, northEast);
	            this.bookmarks.push({ name: bookmark.name, bounds: bounds });
	          }.bind(this));
	        }

	        this._loaded = true;
	        this.fire('load');
	      }
	    }.bind(this));
	  }
	});

	function webMap (webmapId, options) {
	  return new WebMap(webmapId, options);
	}

	exports.WebMap = WebMap;
	exports.webMap = webMap;
	exports.operationalLayer = operationalLayer;
	exports.FeatureCollection = FeatureCollection;
	exports.featureCollection = featureCollection;
	exports.LabelMarker = LabelMarker;
	exports.labelMarker = labelMarker;
	exports.LabelIcon = LabelIcon;
	exports.labelIcon = labelIcon;
	exports.createPopupContent = createPopupContent;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9hcmNnaXMtdG8tZ2VvanNvbi11dGlscy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1N5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL25vZGVfbW9kdWxlcy9sZWFmbGV0LXNoYXBlLW1hcmtlcnMvc3JjL1NoYXBlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvQ3Jvc3NNYXJrZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9ub2RlX21vZHVsZXMvbGVhZmxldC1zaGFwZS1tYXJrZXJzL3NyYy9YTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvU3F1YXJlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvRGlhbW9uZE1hcmtlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvaW50U3ltYm9sLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1N5bWJvbHMvTGluZVN5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvbHlnb25TeW1ib2wuanMiLCIuLi9ub2RlX21vZHVsZXMvZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9VbmlxdWVWYWx1ZVJlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9GZWF0dXJlQ29sbGVjdGlvbi5qcyIsIi4uL3NyYy9MYWJlbC9MYWJlbEljb24uanMiLCIuLi9zcmMvTGFiZWwvTGFiZWxNYXJrZXIuanMiLCIuLi9zcmMvTGFiZWwvUG9pbnRMYWJlbC5qcyIsIi4uL3NyYy9MYWJlbC9Qb2x5bGluZUxhYmVsLmpzIiwiLi4vc3JjL0xhYmVsL1BvbHlnb25MYWJlbC5qcyIsIi4uL3NyYy9Qb3B1cC9Qb3B1cC5qcyIsIi4uL3NyYy9PcGVyYXRpb25hbExheWVyLmpzIiwiLi4vc3JjL1dlYk1hcExvYWRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQ29weXJpZ2h0IDIwMTUgRXNyaVxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGlzY2Vuc2UuXG4gKi9cblxuLy8gY2hlY2tzIGlmIDIgeCx5IHBvaW50cyBhcmUgZXF1YWxcbmZ1bmN0aW9uIHBvaW50c0VxdWFsIChhLCBiKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyBjaGVja3MgaWYgdGhlIGZpcnN0IGFuZCBsYXN0IHBvaW50cyBvZiBhIHJpbmcgYXJlIGVxdWFsIGFuZCBjbG9zZXMgdGhlIHJpbmdcbmZ1bmN0aW9uIGNsb3NlUmluZyAoY29vcmRpbmF0ZXMpIHtcbiAgaWYgKCFwb2ludHNFcXVhbChjb29yZGluYXRlc1swXSwgY29vcmRpbmF0ZXNbY29vcmRpbmF0ZXMubGVuZ3RoIC0gMV0pKSB7XG4gICAgY29vcmRpbmF0ZXMucHVzaChjb29yZGluYXRlc1swXSk7XG4gIH1cbiAgcmV0dXJuIGNvb3JkaW5hdGVzO1xufVxuXG4vLyBkZXRlcm1pbmUgaWYgcG9seWdvbiByaW5nIGNvb3JkaW5hdGVzIGFyZSBjbG9ja3dpc2UuIGNsb2Nrd2lzZSBzaWduaWZpZXMgb3V0ZXIgcmluZywgY291bnRlci1jbG9ja3dpc2UgYW4gaW5uZXIgcmluZ1xuLy8gb3IgaG9sZS4gdGhpcyBsb2dpYyB3YXMgZm91bmQgYXQgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMTY1NjQ3L2hvdy10by1kZXRlcm1pbmUtaWYtYS1saXN0LW9mLXBvbHlnb24tXG4vLyBwb2ludHMtYXJlLWluLWNsb2Nrd2lzZS1vcmRlclxuZnVuY3Rpb24gcmluZ0lzQ2xvY2t3aXNlIChyaW5nVG9UZXN0KSB7XG4gIHZhciB0b3RhbCA9IDA7XG4gIHZhciBpID0gMDtcbiAgdmFyIHJMZW5ndGggPSByaW5nVG9UZXN0Lmxlbmd0aDtcbiAgdmFyIHB0MSA9IHJpbmdUb1Rlc3RbaV07XG4gIHZhciBwdDI7XG4gIGZvciAoaTsgaSA8IHJMZW5ndGggLSAxOyBpKyspIHtcbiAgICBwdDIgPSByaW5nVG9UZXN0W2kgKyAxXTtcbiAgICB0b3RhbCArPSAocHQyWzBdIC0gcHQxWzBdKSAqIChwdDJbMV0gKyBwdDFbMV0pO1xuICAgIHB0MSA9IHB0MjtcbiAgfVxuICByZXR1cm4gKHRvdGFsID49IDApO1xufVxuXG4vLyBwb3J0ZWQgZnJvbSB0ZXJyYWZvcm1lci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9UZXJyYWZvcm1lci9ibG9iL21hc3Rlci90ZXJyYWZvcm1lci5qcyNMNTA0LUw1MTlcbmZ1bmN0aW9uIHZlcnRleEludGVyc2VjdHNWZXJ0ZXggKGExLCBhMiwgYjEsIGIyKSB7XG4gIHZhciB1YVQgPSAoYjJbMF0gLSBiMVswXSkgKiAoYTFbMV0gLSBiMVsxXSkgLSAoYjJbMV0gLSBiMVsxXSkgKiAoYTFbMF0gLSBiMVswXSk7XG4gIHZhciB1YlQgPSAoYTJbMF0gLSBhMVswXSkgKiAoYTFbMV0gLSBiMVsxXSkgLSAoYTJbMV0gLSBhMVsxXSkgKiAoYTFbMF0gLSBiMVswXSk7XG4gIHZhciB1QiA9IChiMlsxXSAtIGIxWzFdKSAqIChhMlswXSAtIGExWzBdKSAtIChiMlswXSAtIGIxWzBdKSAqIChhMlsxXSAtIGExWzFdKTtcblxuICBpZiAodUIgIT09IDApIHtcbiAgICB2YXIgdWEgPSB1YVQgLyB1QjtcbiAgICB2YXIgdWIgPSB1YlQgLyB1QjtcblxuICAgIGlmICh1YSA+PSAwICYmIHVhIDw9IDEgJiYgdWIgPj0gMCAmJiB1YiA8PSAxKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIHBvcnRlZCBmcm9tIHRlcnJhZm9ybWVyLmpzIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL1RlcnJhZm9ybWVyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLmpzI0w1MjEtTDUzMVxuZnVuY3Rpb24gYXJyYXlJbnRlcnNlY3RzQXJyYXkgKGEsIGIpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aCAtIDE7IGkrKykge1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgYi5sZW5ndGggLSAxOyBqKyspIHtcbiAgICAgIGlmICh2ZXJ0ZXhJbnRlcnNlY3RzVmVydGV4KGFbaV0sIGFbaSArIDFdLCBiW2pdLCBiW2ogKyAxXSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBwb3J0ZWQgZnJvbSB0ZXJyYWZvcm1lci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9UZXJyYWZvcm1lci9ibG9iL21hc3Rlci90ZXJyYWZvcm1lci5qcyNMNDcwLUw0ODBcbmZ1bmN0aW9uIGNvb3JkaW5hdGVzQ29udGFpblBvaW50IChjb29yZGluYXRlcywgcG9pbnQpIHtcbiAgdmFyIGNvbnRhaW5zID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAtMSwgbCA9IGNvb3JkaW5hdGVzLmxlbmd0aCwgaiA9IGwgLSAxOyArK2kgPCBsOyBqID0gaSkge1xuICAgIGlmICgoKGNvb3JkaW5hdGVzW2ldWzFdIDw9IHBvaW50WzFdICYmIHBvaW50WzFdIDwgY29vcmRpbmF0ZXNbal1bMV0pIHx8XG4gICAgICAgICAoY29vcmRpbmF0ZXNbal1bMV0gPD0gcG9pbnRbMV0gJiYgcG9pbnRbMV0gPCBjb29yZGluYXRlc1tpXVsxXSkpICYmXG4gICAgICAgIChwb2ludFswXSA8IChjb29yZGluYXRlc1tqXVswXSAtIGNvb3JkaW5hdGVzW2ldWzBdKSAqIChwb2ludFsxXSAtIGNvb3JkaW5hdGVzW2ldWzFdKSAvIChjb29yZGluYXRlc1tqXVsxXSAtIGNvb3JkaW5hdGVzW2ldWzFdKSArIGNvb3JkaW5hdGVzW2ldWzBdKSkge1xuICAgICAgY29udGFpbnMgPSAhY29udGFpbnM7XG4gICAgfVxuICB9XG4gIHJldHVybiBjb250YWlucztcbn1cblxuLy8gcG9ydGVkIGZyb20gdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS90ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIuanMjTDEwNi1MMTEzXG5mdW5jdGlvbiBjb29yZGluYXRlc0NvbnRhaW5Db29yZGluYXRlcyAob3V0ZXIsIGlubmVyKSB7XG4gIHZhciBpbnRlcnNlY3RzID0gYXJyYXlJbnRlcnNlY3RzQXJyYXkob3V0ZXIsIGlubmVyKTtcbiAgdmFyIGNvbnRhaW5zID0gY29vcmRpbmF0ZXNDb250YWluUG9pbnQob3V0ZXIsIGlubmVyWzBdKTtcbiAgaWYgKCFpbnRlcnNlY3RzICYmIGNvbnRhaW5zKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBkbyBhbnkgcG9seWdvbnMgaW4gdGhpcyBhcnJheSBjb250YWluIGFueSBvdGhlciBwb2x5Z29ucyBpbiB0aGlzIGFycmF5P1xuLy8gdXNlZCBmb3IgY2hlY2tpbmcgZm9yIGhvbGVzIGluIGFyY2dpcyByaW5nc1xuLy8gcG9ydGVkIGZyb20gdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS90ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIuanMjTDExNy1MMTcyXG5mdW5jdGlvbiBjb252ZXJ0UmluZ3NUb0dlb0pTT04gKHJpbmdzKSB7XG4gIHZhciBvdXRlclJpbmdzID0gW107XG4gIHZhciBob2xlcyA9IFtdO1xuICB2YXIgeDsgLy8gaXRlcmF0b3JcbiAgdmFyIG91dGVyUmluZzsgLy8gY3VycmVudCBvdXRlciByaW5nIGJlaW5nIGV2YWx1YXRlZFxuICB2YXIgaG9sZTsgLy8gY3VycmVudCBob2xlIGJlaW5nIGV2YWx1YXRlZFxuXG4gIC8vIGZvciBlYWNoIHJpbmdcbiAgZm9yICh2YXIgciA9IDA7IHIgPCByaW5ncy5sZW5ndGg7IHIrKykge1xuICAgIHZhciByaW5nID0gY2xvc2VSaW5nKHJpbmdzW3JdLnNsaWNlKDApKTtcbiAgICBpZiAocmluZy5sZW5ndGggPCA0KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gaXMgdGhpcyByaW5nIGFuIG91dGVyIHJpbmc/IGlzIGl0IGNsb2Nrd2lzZT9cbiAgICBpZiAocmluZ0lzQ2xvY2t3aXNlKHJpbmcpKSB7XG4gICAgICB2YXIgcG9seWdvbiA9IFsgcmluZyBdO1xuICAgICAgb3V0ZXJSaW5ncy5wdXNoKHBvbHlnb24pOyAvLyBwdXNoIHRvIG91dGVyIHJpbmdzXG4gICAgfSBlbHNlIHtcbiAgICAgIGhvbGVzLnB1c2gocmluZyk7IC8vIGNvdW50ZXJjbG9ja3dpc2UgcHVzaCB0byBob2xlc1xuICAgIH1cbiAgfVxuXG4gIHZhciB1bmNvbnRhaW5lZEhvbGVzID0gW107XG5cbiAgLy8gd2hpbGUgdGhlcmUgYXJlIGhvbGVzIGxlZnQuLi5cbiAgd2hpbGUgKGhvbGVzLmxlbmd0aCkge1xuICAgIC8vIHBvcCBhIGhvbGUgb2ZmIG91dCBzdGFja1xuICAgIGhvbGUgPSBob2xlcy5wb3AoKTtcblxuICAgIC8vIGxvb3Agb3ZlciBhbGwgb3V0ZXIgcmluZ3MgYW5kIHNlZSBpZiB0aGV5IGNvbnRhaW4gb3VyIGhvbGUuXG4gICAgdmFyIGNvbnRhaW5lZCA9IGZhbHNlO1xuICAgIGZvciAoeCA9IG91dGVyUmluZ3MubGVuZ3RoIC0gMTsgeCA+PSAwOyB4LS0pIHtcbiAgICAgIG91dGVyUmluZyA9IG91dGVyUmluZ3NbeF1bMF07XG4gICAgICBpZiAoY29vcmRpbmF0ZXNDb250YWluQ29vcmRpbmF0ZXMob3V0ZXJSaW5nLCBob2xlKSkge1xuICAgICAgICAvLyB0aGUgaG9sZSBpcyBjb250YWluZWQgcHVzaCBpdCBpbnRvIG91ciBwb2x5Z29uXG4gICAgICAgIG91dGVyUmluZ3NbeF0ucHVzaChob2xlKTtcbiAgICAgICAgY29udGFpbmVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmluZyBpcyBub3QgY29udGFpbmVkIGluIGFueSBvdXRlciByaW5nXG4gICAgLy8gc29tZXRpbWVzIHRoaXMgaGFwcGVucyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9lc3JpLWxlYWZsZXQvaXNzdWVzLzMyMFxuICAgIGlmICghY29udGFpbmVkKSB7XG4gICAgICB1bmNvbnRhaW5lZEhvbGVzLnB1c2goaG9sZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgd2UgY291bGRuJ3QgbWF0Y2ggYW55IGhvbGVzIHVzaW5nIGNvbnRhaW5zIHdlIGNhbiB0cnkgaW50ZXJzZWN0cy4uLlxuICB3aGlsZSAodW5jb250YWluZWRIb2xlcy5sZW5ndGgpIHtcbiAgICAvLyBwb3AgYSBob2xlIG9mZiBvdXQgc3RhY2tcbiAgICBob2xlID0gdW5jb250YWluZWRIb2xlcy5wb3AoKTtcblxuICAgIC8vIGxvb3Agb3ZlciBhbGwgb3V0ZXIgcmluZ3MgYW5kIHNlZSBpZiBhbnkgaW50ZXJzZWN0IG91ciBob2xlLlxuICAgIHZhciBpbnRlcnNlY3RzID0gZmFsc2U7XG5cbiAgICBmb3IgKHggPSBvdXRlclJpbmdzLmxlbmd0aCAtIDE7IHggPj0gMDsgeC0tKSB7XG4gICAgICBvdXRlclJpbmcgPSBvdXRlclJpbmdzW3hdWzBdO1xuICAgICAgaWYgKGFycmF5SW50ZXJzZWN0c0FycmF5KG91dGVyUmluZywgaG9sZSkpIHtcbiAgICAgICAgLy8gdGhlIGhvbGUgaXMgY29udGFpbmVkIHB1c2ggaXQgaW50byBvdXIgcG9seWdvblxuICAgICAgICBvdXRlclJpbmdzW3hdLnB1c2goaG9sZSk7XG4gICAgICAgIGludGVyc2VjdHMgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWludGVyc2VjdHMpIHtcbiAgICAgIG91dGVyUmluZ3MucHVzaChbaG9sZS5yZXZlcnNlKCldKTtcbiAgICB9XG4gIH1cblxuICBpZiAob3V0ZXJSaW5ncy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ1BvbHlnb24nLFxuICAgICAgY29vcmRpbmF0ZXM6IG91dGVyUmluZ3NbMF1cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnTXVsdGlQb2x5Z29uJyxcbiAgICAgIGNvb3JkaW5hdGVzOiBvdXRlclJpbmdzXG4gICAgfTtcbiAgfVxufVxuXG4vLyBUaGlzIGZ1bmN0aW9uIGVuc3VyZXMgdGhhdCByaW5ncyBhcmUgb3JpZW50ZWQgaW4gdGhlIHJpZ2h0IGRpcmVjdGlvbnNcbi8vIG91dGVyIHJpbmdzIGFyZSBjbG9ja3dpc2UsIGhvbGVzIGFyZSBjb3VudGVyY2xvY2t3aXNlXG4vLyB1c2VkIGZvciBjb252ZXJ0aW5nIEdlb0pTT04gUG9seWdvbnMgdG8gQXJjR0lTIFBvbHlnb25zXG5mdW5jdGlvbiBvcmllbnRSaW5ncyAocG9seSkge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIHZhciBwb2x5Z29uID0gcG9seS5zbGljZSgwKTtcbiAgdmFyIG91dGVyUmluZyA9IGNsb3NlUmluZyhwb2x5Z29uLnNoaWZ0KCkuc2xpY2UoMCkpO1xuICBpZiAob3V0ZXJSaW5nLmxlbmd0aCA+PSA0KSB7XG4gICAgaWYgKCFyaW5nSXNDbG9ja3dpc2Uob3V0ZXJSaW5nKSkge1xuICAgICAgb3V0ZXJSaW5nLnJldmVyc2UoKTtcbiAgICB9XG5cbiAgICBvdXRwdXQucHVzaChvdXRlclJpbmcpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb2x5Z29uLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaG9sZSA9IGNsb3NlUmluZyhwb2x5Z29uW2ldLnNsaWNlKDApKTtcbiAgICAgIGlmIChob2xlLmxlbmd0aCA+PSA0KSB7XG4gICAgICAgIGlmIChyaW5nSXNDbG9ja3dpc2UoaG9sZSkpIHtcbiAgICAgICAgICBob2xlLnJldmVyc2UoKTtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQucHVzaChob2xlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0O1xufVxuXG4vLyBUaGlzIGZ1bmN0aW9uIGZsYXR0ZW5zIGhvbGVzIGluIG11bHRpcG9seWdvbnMgdG8gb25lIGFycmF5IG9mIHBvbHlnb25zXG4vLyB1c2VkIGZvciBjb252ZXJ0aW5nIEdlb0pTT04gUG9seWdvbnMgdG8gQXJjR0lTIFBvbHlnb25zXG5mdW5jdGlvbiBmbGF0dGVuTXVsdGlQb2x5Z29uUmluZ3MgKHJpbmdzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCByaW5ncy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBwb2x5Z29uID0gb3JpZW50UmluZ3MocmluZ3NbaV0pO1xuICAgIGZvciAodmFyIHggPSBwb2x5Z29uLmxlbmd0aCAtIDE7IHggPj0gMDsgeC0tKSB7XG4gICAgICB2YXIgcmluZyA9IHBvbHlnb25beF0uc2xpY2UoMCk7XG4gICAgICBvdXRwdXQucHVzaChyaW5nKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuLy8gc2hhbGxvdyBvYmplY3QgY2xvbmUgZm9yIGZlYXR1cmUgcHJvcGVydGllcyBhbmQgYXR0cmlidXRlc1xuLy8gZnJvbSBodHRwOi8vanNwZXJmLmNvbS9jbG9uaW5nLWFuLW9iamVjdC8yXG5mdW5jdGlvbiBzaGFsbG93Q2xvbmUgKG9iaikge1xuICB2YXIgdGFyZ2V0ID0ge307XG4gIGZvciAodmFyIGkgaW4gb2JqKSB7XG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgdGFyZ2V0W2ldID0gb2JqW2ldO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXJjZ2lzVG9HZW9KU09OIChhcmNnaXMsIGlkQXR0cmlidXRlKSB7XG4gIHZhciBnZW9qc29uID0ge307XG5cbiAgaWYgKHR5cGVvZiBhcmNnaXMueCA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGFyY2dpcy55ID09PSAnbnVtYmVyJykge1xuICAgIGdlb2pzb24udHlwZSA9ICdQb2ludCc7XG4gICAgZ2VvanNvbi5jb29yZGluYXRlcyA9IFthcmNnaXMueCwgYXJjZ2lzLnldO1xuICB9XG5cbiAgaWYgKGFyY2dpcy5wb2ludHMpIHtcbiAgICBnZW9qc29uLnR5cGUgPSAnTXVsdGlQb2ludCc7XG4gICAgZ2VvanNvbi5jb29yZGluYXRlcyA9IGFyY2dpcy5wb2ludHMuc2xpY2UoMCk7XG4gIH1cblxuICBpZiAoYXJjZ2lzLnBhdGhzKSB7XG4gICAgaWYgKGFyY2dpcy5wYXRocy5sZW5ndGggPT09IDEpIHtcbiAgICAgIGdlb2pzb24udHlwZSA9ICdMaW5lU3RyaW5nJztcbiAgICAgIGdlb2pzb24uY29vcmRpbmF0ZXMgPSBhcmNnaXMucGF0aHNbMF0uc2xpY2UoMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdlb2pzb24udHlwZSA9ICdNdWx0aUxpbmVTdHJpbmcnO1xuICAgICAgZ2VvanNvbi5jb29yZGluYXRlcyA9IGFyY2dpcy5wYXRocy5zbGljZSgwKTtcbiAgICB9XG4gIH1cblxuICBpZiAoYXJjZ2lzLnJpbmdzKSB7XG4gICAgZ2VvanNvbiA9IGNvbnZlcnRSaW5nc1RvR2VvSlNPTihhcmNnaXMucmluZ3Muc2xpY2UoMCkpO1xuICB9XG5cbiAgaWYgKGFyY2dpcy5nZW9tZXRyeSB8fCBhcmNnaXMuYXR0cmlidXRlcykge1xuICAgIGdlb2pzb24udHlwZSA9ICdGZWF0dXJlJztcbiAgICBnZW9qc29uLmdlb21ldHJ5ID0gKGFyY2dpcy5nZW9tZXRyeSkgPyBhcmNnaXNUb0dlb0pTT04oYXJjZ2lzLmdlb21ldHJ5KSA6IG51bGw7XG4gICAgZ2VvanNvbi5wcm9wZXJ0aWVzID0gKGFyY2dpcy5hdHRyaWJ1dGVzKSA/IHNoYWxsb3dDbG9uZShhcmNnaXMuYXR0cmlidXRlcykgOiBudWxsO1xuICAgIGlmIChhcmNnaXMuYXR0cmlidXRlcykge1xuICAgICAgZ2VvanNvbi5pZCA9IGFyY2dpcy5hdHRyaWJ1dGVzW2lkQXR0cmlidXRlXSB8fCBhcmNnaXMuYXR0cmlidXRlcy5PQkpFQ1RJRCB8fCBhcmNnaXMuYXR0cmlidXRlcy5GSUQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGdlb2pzb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW9qc29uVG9BcmNHSVMgKGdlb2pzb24sIGlkQXR0cmlidXRlKSB7XG4gIGlkQXR0cmlidXRlID0gaWRBdHRyaWJ1dGUgfHwgJ09CSkVDVElEJztcbiAgdmFyIHNwYXRpYWxSZWZlcmVuY2UgPSB7IHdraWQ6IDQzMjYgfTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICB2YXIgaTtcblxuICBzd2l0Y2ggKGdlb2pzb24udHlwZSkge1xuICAgIGNhc2UgJ1BvaW50JzpcbiAgICAgIHJlc3VsdC54ID0gZ2VvanNvbi5jb29yZGluYXRlc1swXTtcbiAgICAgIHJlc3VsdC55ID0gZ2VvanNvbi5jb29yZGluYXRlc1sxXTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ011bHRpUG9pbnQnOlxuICAgICAgcmVzdWx0LnBvaW50cyA9IGdlb2pzb24uY29vcmRpbmF0ZXMuc2xpY2UoMCk7XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdMaW5lU3RyaW5nJzpcbiAgICAgIHJlc3VsdC5wYXRocyA9IFtnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApXTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ011bHRpTGluZVN0cmluZyc6XG4gICAgICByZXN1bHQucGF0aHMgPSBnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApO1xuICAgICAgcmVzdWx0LnNwYXRpYWxSZWZlcmVuY2UgPSBzcGF0aWFsUmVmZXJlbmNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnUG9seWdvbic6XG4gICAgICByZXN1bHQucmluZ3MgPSBvcmllbnRSaW5ncyhnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApKTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ011bHRpUG9seWdvbic6XG4gICAgICByZXN1bHQucmluZ3MgPSBmbGF0dGVuTXVsdGlQb2x5Z29uUmluZ3MoZ2VvanNvbi5jb29yZGluYXRlcy5zbGljZSgwKSk7XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdGZWF0dXJlJzpcbiAgICAgIGlmIChnZW9qc29uLmdlb21ldHJ5KSB7XG4gICAgICAgIHJlc3VsdC5nZW9tZXRyeSA9IGdlb2pzb25Ub0FyY0dJUyhnZW9qc29uLmdlb21ldHJ5LCBpZEF0dHJpYnV0ZSk7XG4gICAgICB9XG4gICAgICByZXN1bHQuYXR0cmlidXRlcyA9IChnZW9qc29uLnByb3BlcnRpZXMpID8gc2hhbGxvd0Nsb25lKGdlb2pzb24ucHJvcGVydGllcykgOiB7fTtcbiAgICAgIGlmIChnZW9qc29uLmlkKSB7XG4gICAgICAgIHJlc3VsdC5hdHRyaWJ1dGVzW2lkQXR0cmlidXRlXSA9IGdlb2pzb24uaWQ7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdGZWF0dXJlQ29sbGVjdGlvbic6XG4gICAgICByZXN1bHQgPSBbXTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBnZW9qc29uLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGdlb2pzb25Ub0FyY0dJUyhnZW9qc29uLmZlYXR1cmVzW2ldLCBpZEF0dHJpYnV0ZSkpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnR2VvbWV0cnlDb2xsZWN0aW9uJzpcbiAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGdlb2pzb24uZ2VvbWV0cmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXN1bHQucHVzaChnZW9qc29uVG9BcmNHSVMoZ2VvanNvbi5nZW9tZXRyaWVzW2ldLCBpZEF0dHJpYnV0ZSkpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5cbmV4cG9ydCB2YXIgU3ltYm9sID0gTC5DbGFzcy5leHRlbmQoe1xuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICAgIHRoaXMuX3N5bWJvbEpzb24gPSBzeW1ib2xKc29uO1xuICAgIHRoaXMudmFsID0gbnVsbDtcbiAgICB0aGlzLl9zdHlsZXMgPSB7fTtcbiAgICB0aGlzLl9pc0RlZmF1bHQgPSBmYWxzZTtcbiAgICB0aGlzLl9sYXllclRyYW5zcGFyZW5jeSA9IDE7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5sYXllclRyYW5zcGFyZW5jeSkge1xuICAgICAgdGhpcy5fbGF5ZXJUcmFuc3BhcmVuY3kgPSAxIC0gKG9wdGlvbnMubGF5ZXJUcmFuc3BhcmVuY3kgLyAxMDAuMCk7XG4gICAgfVxuICB9LFxuXG4gIC8vIHRoZSBnZW9qc29uIHZhbHVlcyByZXR1cm5lZCBhcmUgaW4gcG9pbnRzXG4gIHBpeGVsVmFsdWU6IGZ1bmN0aW9uIChwb2ludFZhbHVlKSB7XG4gICAgcmV0dXJuIHBvaW50VmFsdWUgKiAxLjMzMztcbiAgfSxcblxuICAvLyBjb2xvciBpcyBhbiBhcnJheSBbcixnLGIsYV1cbiAgY29sb3JWYWx1ZTogZnVuY3Rpb24gKGNvbG9yKSB7XG4gICAgcmV0dXJuICdyZ2IoJyArIGNvbG9yWzBdICsgJywnICsgY29sb3JbMV0gKyAnLCcgKyBjb2xvclsyXSArICcpJztcbiAgfSxcblxuICBhbHBoYVZhbHVlOiBmdW5jdGlvbiAoY29sb3IpIHtcbiAgICB2YXIgYWxwaGEgPSBjb2xvclszXSAvIDI1NS4wO1xuICAgIHJldHVybiBhbHBoYSAqIHRoaXMuX2xheWVyVHJhbnNwYXJlbmN5O1xuICB9LFxuXG4gIGdldFNpemU6IGZ1bmN0aW9uIChmZWF0dXJlLCBzaXplSW5mbykge1xuICAgIHZhciBhdHRyID0gZmVhdHVyZS5wcm9wZXJ0aWVzO1xuICAgIHZhciBmaWVsZCA9IHNpemVJbmZvLmZpZWxkO1xuICAgIHZhciBzaXplID0gMDtcbiAgICB2YXIgZmVhdHVyZVZhbHVlID0gbnVsbDtcblxuICAgIGlmIChmaWVsZCkge1xuICAgICAgZmVhdHVyZVZhbHVlID0gYXR0cltmaWVsZF07XG4gICAgICB2YXIgbWluU2l6ZSA9IHNpemVJbmZvLm1pblNpemU7XG4gICAgICB2YXIgbWF4U2l6ZSA9IHNpemVJbmZvLm1heFNpemU7XG4gICAgICB2YXIgbWluRGF0YVZhbHVlID0gc2l6ZUluZm8ubWluRGF0YVZhbHVlO1xuICAgICAgdmFyIG1heERhdGFWYWx1ZSA9IHNpemVJbmZvLm1heERhdGFWYWx1ZTtcbiAgICAgIHZhciBmZWF0dXJlUmF0aW87XG4gICAgICB2YXIgbm9ybUZpZWxkID0gc2l6ZUluZm8ubm9ybWFsaXphdGlvbkZpZWxkO1xuICAgICAgdmFyIG5vcm1WYWx1ZSA9IGF0dHIgPyBwYXJzZUZsb2F0KGF0dHJbbm9ybUZpZWxkXSkgOiB1bmRlZmluZWQ7XG5cbiAgICAgIGlmIChmZWF0dXJlVmFsdWUgPT09IG51bGwgfHwgKG5vcm1GaWVsZCAmJiAoKGlzTmFOKG5vcm1WYWx1ZSkgfHwgbm9ybVZhbHVlID09PSAwKSkpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzTmFOKG5vcm1WYWx1ZSkpIHtcbiAgICAgICAgZmVhdHVyZVZhbHVlIC89IG5vcm1WYWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1pblNpemUgIT09IG51bGwgJiYgbWF4U2l6ZSAhPT0gbnVsbCAmJiBtaW5EYXRhVmFsdWUgIT09IG51bGwgJiYgbWF4RGF0YVZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChmZWF0dXJlVmFsdWUgPD0gbWluRGF0YVZhbHVlKSB7XG4gICAgICAgICAgc2l6ZSA9IG1pblNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAoZmVhdHVyZVZhbHVlID49IG1heERhdGFWYWx1ZSkge1xuICAgICAgICAgIHNpemUgPSBtYXhTaXplO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZlYXR1cmVSYXRpbyA9IChmZWF0dXJlVmFsdWUgLSBtaW5EYXRhVmFsdWUpIC8gKG1heERhdGFWYWx1ZSAtIG1pbkRhdGFWYWx1ZSk7XG4gICAgICAgICAgc2l6ZSA9IG1pblNpemUgKyAoZmVhdHVyZVJhdGlvICogKG1heFNpemUgLSBtaW5TaXplKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHNpemUgPSBpc05hTihzaXplKSA/IDAgOiBzaXplO1xuICAgIH1cbiAgICByZXR1cm4gc2l6ZTtcbiAgfSxcblxuICBnZXRDb2xvcjogZnVuY3Rpb24gKGZlYXR1cmUsIGNvbG9ySW5mbykge1xuICAgIC8vIHJlcXVpcmVkIGluZm9ybWF0aW9uIHRvIGdldCBjb2xvclxuICAgIGlmICghKGZlYXR1cmUucHJvcGVydGllcyAmJiBjb2xvckluZm8gJiYgY29sb3JJbmZvLmZpZWxkICYmIGNvbG9ySW5mby5zdG9wcykpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciBhdHRyID0gZmVhdHVyZS5wcm9wZXJ0aWVzO1xuICAgIHZhciBmZWF0dXJlVmFsdWUgPSBhdHRyW2NvbG9ySW5mby5maWVsZF07XG4gICAgdmFyIGxvd2VyQm91bmRDb2xvciwgdXBwZXJCb3VuZENvbG9yLCBsb3dlckJvdW5kLCB1cHBlckJvdW5kO1xuICAgIHZhciBub3JtRmllbGQgPSBjb2xvckluZm8ubm9ybWFsaXphdGlvbkZpZWxkO1xuICAgIHZhciBub3JtVmFsdWUgPSBhdHRyID8gcGFyc2VGbG9hdChhdHRyW25vcm1GaWVsZF0pIDogdW5kZWZpbmVkO1xuICAgIGlmIChmZWF0dXJlVmFsdWUgPT09IG51bGwgfHwgKG5vcm1GaWVsZCAmJiAoKGlzTmFOKG5vcm1WYWx1ZSkgfHwgbm9ybVZhbHVlID09PSAwKSkpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIWlzTmFOKG5vcm1WYWx1ZSkpIHtcbiAgICAgIGZlYXR1cmVWYWx1ZSAvPSBub3JtVmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKGZlYXR1cmVWYWx1ZSA8PSBjb2xvckluZm8uc3RvcHNbMF0udmFsdWUpIHtcbiAgICAgIHJldHVybiBjb2xvckluZm8uc3RvcHNbMF0uY29sb3I7XG4gICAgfVxuICAgIHZhciBsYXN0U3RvcCA9IGNvbG9ySW5mby5zdG9wc1tjb2xvckluZm8uc3RvcHMubGVuZ3RoIC0gMV07XG4gICAgaWYgKGZlYXR1cmVWYWx1ZSA+PSBsYXN0U3RvcC52YWx1ZSkge1xuICAgICAgcmV0dXJuIGxhc3RTdG9wLmNvbG9yO1xuICAgIH1cblxuICAgIC8vIGdvIHRocm91Z2ggdGhlIHN0b3BzIHRvIGZpbmQgbWluIGFuZCBtYXhcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbG9ySW5mby5zdG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0b3BJbmZvID0gY29sb3JJbmZvLnN0b3BzW2ldO1xuXG4gICAgICBpZiAoc3RvcEluZm8udmFsdWUgPD0gZmVhdHVyZVZhbHVlKSB7XG4gICAgICAgIGxvd2VyQm91bmRDb2xvciA9IHN0b3BJbmZvLmNvbG9yO1xuICAgICAgICBsb3dlckJvdW5kID0gc3RvcEluZm8udmFsdWU7XG4gICAgICB9IGVsc2UgaWYgKHN0b3BJbmZvLnZhbHVlID4gZmVhdHVyZVZhbHVlKSB7XG4gICAgICAgIHVwcGVyQm91bmRDb2xvciA9IHN0b3BJbmZvLmNvbG9yO1xuICAgICAgICB1cHBlckJvdW5kID0gc3RvcEluZm8udmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZlYXR1cmUgZmFsbHMgYmV0d2VlbiB0d28gc3RvcHMsIGludGVycGxhdGUgdGhlIGNvbG9yc1xuICAgIGlmICghaXNOYU4obG93ZXJCb3VuZCkgJiYgIWlzTmFOKHVwcGVyQm91bmQpKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB1cHBlckJvdW5kIC0gbG93ZXJCb3VuZDtcbiAgICAgIGlmIChyYW5nZSA+IDApIHtcbiAgICAgICAgLy8gbW9yZSB3ZWlnaHQgdGhlIGZ1cnRoZXIgaXQgaXMgZnJvbSB0aGUgbG93ZXIgYm91bmRcbiAgICAgICAgdmFyIHVwcGVyQm91bmRDb2xvcldlaWdodCA9IChmZWF0dXJlVmFsdWUgLSBsb3dlckJvdW5kKSAvIHJhbmdlO1xuICAgICAgICBpZiAodXBwZXJCb3VuZENvbG9yV2VpZ2h0KSB7XG4gICAgICAgICAgLy8gbW9yZSB3ZWlnaHQgdGhlIGZ1cnRoZXIgaXQgaXMgZnJvbSB0aGUgdXBwZXIgYm91bmRcbiAgICAgICAgICB2YXIgbG93ZXJCb3VuZENvbG9yV2VpZ2h0ID0gKHVwcGVyQm91bmQgLSBmZWF0dXJlVmFsdWUpIC8gcmFuZ2U7XG4gICAgICAgICAgaWYgKGxvd2VyQm91bmRDb2xvcldlaWdodCkge1xuICAgICAgICAgICAgLy8gaW50ZXJwb2xhdGUgdGhlIGxvd2VyIGFuZCB1cHBlciBib3VuZCBjb2xvciBieSBhcHBseWluZyB0aGVcbiAgICAgICAgICAgIC8vIHdlaWdodHMgdG8gZWFjaCBvZiB0aGUgcmdiYSBjb2xvcnMgYW5kIGFkZGluZyB0aGVtIHRvZ2V0aGVyXG4gICAgICAgICAgICB2YXIgaW50ZXJwb2xhdGVkQ29sb3IgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgNDsgaisrKSB7XG4gICAgICAgICAgICAgIGludGVycG9sYXRlZENvbG9yW2pdID0gTWF0aC5yb3VuZChsb3dlckJvdW5kQ29sb3Jbal0gKiBsb3dlckJvdW5kQ29sb3JXZWlnaHQgKyB1cHBlckJvdW5kQ29sb3Jbal0gKiB1cHBlckJvdW5kQ29sb3JXZWlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGludGVycG9sYXRlZENvbG9yO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyBkaWZmZXJlbmNlIGJldHdlZW4gZmVhdHVyZVZhbHVlIGFuZCB1cHBlckJvdW5kLCAxMDAlIG9mIHVwcGVyQm91bmRDb2xvclxuICAgICAgICAgICAgcmV0dXJuIHVwcGVyQm91bmRDb2xvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm8gZGlmZmVyZW5jZSBiZXR3ZWVuIGZlYXR1cmVWYWx1ZSBhbmQgbG93ZXJCb3VuZCwgMTAwJSBvZiBsb3dlckJvdW5kQ29sb3JcbiAgICAgICAgICByZXR1cm4gbG93ZXJCb3VuZENvbG9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHdlIGdldCB0byBoZXJlLCBub25lIG9mIHRoZSBjYXNlcyBhcHBseSBzbyByZXR1cm4gbnVsbFxuICAgIHJldHVybiBudWxsO1xuICB9XG59KTtcblxuLy8gZXhwb3J0IGZ1bmN0aW9uIHN5bWJvbCAoc3ltYm9sSnNvbikge1xuLy8gICByZXR1cm4gbmV3IFN5bWJvbChzeW1ib2xKc29uKTtcbi8vIH1cblxuZXhwb3J0IGRlZmF1bHQgU3ltYm9sO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5cbmV4cG9ydCB2YXIgU2hhcGVNYXJrZXIgPSBMLlBhdGguZXh0ZW5kKHtcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICAgIHRoaXMuX3NpemUgPSBzaXplO1xuICAgIHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XG4gICAgdGhpcy5fc3ZnQ2FudmFzSW5jbHVkZXMoKTtcbiAgfSxcblxuICB0b0dlb0pTT046IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xuICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgIGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5nZXRMYXRMbmcoKSlcbiAgICB9KTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBpbXBsZW1lbnQgaW4gc3ViIGNsYXNzXG4gIH0sXG5cbiAgX3Byb2plY3Q6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wb2ludCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fbGF0bG5nKTtcbiAgfSxcblxuICBfdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX21hcCkge1xuICAgICAgdGhpcy5fdXBkYXRlUGF0aCgpO1xuICAgIH1cbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIC8vIGltcGxlbWVudCBpbiBzdWIgY2xhc3NcbiAgfSxcblxuICBzZXRMYXRMbmc6IGZ1bmN0aW9uIChsYXRsbmcpIHtcbiAgICB0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xuICAgIHRoaXMucmVkcmF3KCk7XG4gICAgcmV0dXJuIHRoaXMuZmlyZSgnbW92ZScsIHtsYXRsbmc6IHRoaXMuX2xhdGxuZ30pO1xuICB9LFxuXG4gIGdldExhdExuZzogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9sYXRsbmc7XG4gIH0sXG5cbiAgc2V0U2l6ZTogZnVuY3Rpb24gKHNpemUpIHtcbiAgICB0aGlzLl9zaXplID0gc2l6ZTtcbiAgICByZXR1cm4gdGhpcy5yZWRyYXcoKTtcbiAgfSxcblxuICBnZXRTaXplOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NpemU7XG4gIH1cbn0pO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgeyBTaGFwZU1hcmtlciB9IGZyb20gJy4vU2hhcGVNYXJrZXInO1xuXG5leHBvcnQgdmFyIENyb3NzTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZUNyb3NzTWFya2VyKHRoaXMpO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIEwuQ2FudmFzLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZUNyb3NzTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuICAgICAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG5cbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSk7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBMLlNWRy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVDcm9zc01hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgbGF0bG5nLnggKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyBsYXRsbmcueCArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdNJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyBsYXRsbmcueSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIGxhdGxuZy55O1xuXG4gICAgICAgIHRoaXMuX3NldFBhdGgobGF5ZXIsIHN0cik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgdmFyIGNyb3NzTWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IENyb3NzTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBjcm9zc01hcmtlcjtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgU2hhcGVNYXJrZXIgfSBmcm9tICcuL1NoYXBlTWFya2VyJztcblxuZXhwb3J0IHZhciBYTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZVhNYXJrZXIodGhpcyk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgTC5DYW52YXMuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlWE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBMLlNWRy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVYTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuXG4gICAgICAgIGlmIChMLkJyb3dzZXIudm1sKSB7XG4gICAgICAgICAgbGF0bG5nLl9yb3VuZCgpO1xuICAgICAgICAgIG9mZnNldCA9IE1hdGgucm91bmQob2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdHIgPSAnTScgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdNJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciB4TWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFhNYXJrZXIobGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHhNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IFNoYXBlTWFya2VyIH0gZnJvbSAnLi9TaGFwZU1hcmtlcic7XG5cbmV4cG9ydCB2YXIgU3F1YXJlTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIGZpbGw6IHRydWVcbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZVNxdWFyZU1hcmtlcih0aGlzKTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBMLkNhbnZhcy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVTcXVhcmVNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG4gICAgICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55IC0gb2Zmc2V0KTtcblxuICAgICAgICBjdHguY2xvc2VQYXRoKCk7XG5cbiAgICAgICAgdGhpcy5fZmlsbFN0cm9rZShjdHgsIGxheWVyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIEwuU1ZHLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZVNxdWFyZU1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCk7XG5cbiAgICAgICAgc3RyID0gc3RyICsgKEwuQnJvd3Nlci5zdmcgPyAneicgOiAneCcpO1xuXG4gICAgICAgIHRoaXMuX3NldFBhdGgobGF5ZXIsIHN0cik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgdmFyIHNxdWFyZU1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBTcXVhcmVNYXJrZXIobGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHNxdWFyZU1hcmtlcjtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgU2hhcGVNYXJrZXIgfSBmcm9tICcuL1NoYXBlTWFya2VyJztcblxuZXhwb3J0IHZhciBEaWFtb25kTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIGZpbGw6IHRydWVcbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZURpYW1vbmRNYXJrZXIodGhpcyk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgTC5DYW52YXMuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlRGlhbW9uZE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLngsIGxhdGxuZy55IC0gb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkpO1xuXG4gICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcblxuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgTC5TVkcuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlRGlhbW9uZE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgbGF0bG5nLnggKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgbGF0bG5nLnkgK1xuICAgICAgICAgICdMJyArIGxhdGxuZy54ICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIGxhdGxuZy55O1xuXG4gICAgICAgIHN0ciA9IHN0ciArIChMLkJyb3dzZXIuc3ZnID8gJ3onIDogJ3gnKTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciBkaWFtb25kTWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IERpYW1vbmRNYXJrZXIobGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRpYW1vbmRNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCBTeW1ib2wgZnJvbSAnLi9TeW1ib2wnO1xuaW1wb3J0IHtzcXVhcmVNYXJrZXIsIHhNYXJrZXIsIGNyb3NzTWFya2VyLCBkaWFtb25kTWFya2VyfSBmcm9tICdsZWFmbGV0LXNoYXBlLW1hcmtlcnMnO1xuXG5leHBvcnQgdmFyIFBvaW50U3ltYm9sID0gU3ltYm9sLmV4dGVuZCh7XG5cbiAgc3RhdGljczoge1xuICAgIE1BUktFUlRZUEVTOiBbJ2VzcmlTTVNDaXJjbGUnLCAnZXNyaVNNU0Nyb3NzJywgJ2VzcmlTTVNEaWFtb25kJywgJ2VzcmlTTVNTcXVhcmUnLCAnZXNyaVNNU1gnLCAnZXNyaVBNUyddXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgICBTeW1ib2wucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBzeW1ib2xKc29uLCBvcHRpb25zKTtcbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgdGhpcy5zZXJ2aWNlVXJsID0gb3B0aW9ucy51cmw7XG4gICAgfVxuICAgIGlmIChzeW1ib2xKc29uKSB7XG4gICAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVBNUycpIHtcbiAgICAgICAgdmFyIHVybCA9IHRoaXMuc2VydmljZVVybCArICdpbWFnZXMvJyArIHRoaXMuX3N5bWJvbEpzb24udXJsO1xuICAgICAgICB0aGlzLl9pY29uVXJsID0gb3B0aW9ucyAmJiBvcHRpb25zLnRva2VuID8gdXJsICsgJz90b2tlbj0nICsgb3B0aW9ucy50b2tlbiA6IHVybDtcbiAgICAgICAgaWYgKHN5bWJvbEpzb24uaW1hZ2VEYXRhKSB7XG4gICAgICAgICAgdGhpcy5faWNvblVybCA9ICdkYXRhOicgKyBzeW1ib2xKc29uLmNvbnRlbnRUeXBlICsgJztiYXNlNjQsJyArIHN5bWJvbEpzb24uaW1hZ2VEYXRhO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxlYWZsZXQgZG9lcyBub3QgYWxsb3cgcmVzaXppbmcgaWNvbnMgc28ga2VlcCBhIGhhc2ggb2YgZGlmZmVyZW50XG4gICAgICAgIC8vIGljb24gc2l6ZXMgdG8gdHJ5IGFuZCBrZWVwIGRvd24gb24gdGhlIG51bWJlciBvZiBpY29ucyBjcmVhdGVkXG4gICAgICAgIHRoaXMuX2ljb25zID0ge307XG4gICAgICAgIC8vIGNyZWF0ZSBiYXNlIGljb25cbiAgICAgICAgdGhpcy5pY29uID0gdGhpcy5fY3JlYXRlSWNvbih0aGlzLl9zeW1ib2xKc29uKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHlsZXMoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgX2ZpbGxTdHlsZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lICYmIHRoaXMuX3N5bWJvbEpzb24uc2l6ZSA+IDApIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5zdHJva2UgPSB0cnVlO1xuICAgICAgdGhpcy5fc3R5bGVzLndlaWdodCA9IHRoaXMucGl4ZWxWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUud2lkdGgpO1xuICAgICAgdGhpcy5fc3R5bGVzLmNvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24ub3V0bGluZS5jb2xvcik7XG4gICAgICB0aGlzLl9zdHlsZXMub3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUuY29sb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdHlsZXMuc3Ryb2tlID0gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKSB7XG4gICAgICB0aGlzLl9zdHlsZXMuZmlsbENvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSAwO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLnN0eWxlID09PSAnZXNyaVNNU0NpcmNsZScpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5yYWRpdXMgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5zaXplKSAvIDIuMDtcbiAgICB9XG4gIH0sXG5cbiAgX2NyZWF0ZUljb246IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIHdpZHRoID0gdGhpcy5waXhlbFZhbHVlKG9wdGlvbnMud2lkdGgpO1xuICAgIHZhciBoZWlnaHQgPSB3aWR0aDtcbiAgICBpZiAob3B0aW9ucy5oZWlnaHQpIHtcbiAgICAgIGhlaWdodCA9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLmhlaWdodCk7XG4gICAgfVxuICAgIHZhciB4T2Zmc2V0ID0gd2lkdGggLyAyLjA7XG4gICAgdmFyIHlPZmZzZXQgPSBoZWlnaHQgLyAyLjA7XG5cbiAgICBpZiAob3B0aW9ucy54b2Zmc2V0KSB7XG4gICAgICB4T2Zmc2V0ICs9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLnhvZmZzZXQpO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy55b2Zmc2V0KSB7XG4gICAgICB5T2Zmc2V0ICs9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLnlvZmZzZXQpO1xuICAgIH1cblxuICAgIHZhciBpY29uID0gTC5pY29uKHtcbiAgICAgIGljb25Vcmw6IHRoaXMuX2ljb25VcmwsXG4gICAgICBpY29uU2l6ZTogW3dpZHRoLCBoZWlnaHRdLFxuICAgICAgaWNvbkFuY2hvcjogW3hPZmZzZXQsIHlPZmZzZXRdXG4gICAgfSk7XG4gICAgdGhpcy5faWNvbnNbb3B0aW9ucy53aWR0aC50b1N0cmluZygpXSA9IGljb247XG4gICAgcmV0dXJuIGljb247XG4gIH0sXG5cbiAgX2dldEljb246IGZ1bmN0aW9uIChzaXplKSB7XG4gICAgLy8gY2hlY2sgdG8gc2VlIGlmIGl0IGlzIGFscmVhZHkgY3JlYXRlZCBieSBzaXplXG4gICAgdmFyIGljb24gPSB0aGlzLl9pY29uc1tzaXplLnRvU3RyaW5nKCldO1xuICAgIGlmICghaWNvbikge1xuICAgICAgaWNvbiA9IHRoaXMuX2NyZWF0ZUljb24oe3dpZHRoOiBzaXplfSk7XG4gICAgfVxuICAgIHJldHVybiBpY29uO1xuICB9LFxuXG4gIHBvaW50VG9MYXllcjogZnVuY3Rpb24gKGdlb2pzb24sIGxhdGxuZywgdmlzdWFsVmFyaWFibGVzLCBvcHRpb25zKSB7XG4gICAgdmFyIHNpemUgPSB0aGlzLl9zeW1ib2xKc29uLnNpemUgfHwgdGhpcy5fc3ltYm9sSnNvbi53aWR0aDtcbiAgICBpZiAoIXRoaXMuX2lzRGVmYXVsdCkge1xuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbykge1xuICAgICAgICB2YXIgY2FsY3VsYXRlZFNpemUgPSB0aGlzLmdldFNpemUoZ2VvanNvbiwgdmlzdWFsVmFyaWFibGVzLnNpemVJbmZvKTtcbiAgICAgICAgaWYgKGNhbGN1bGF0ZWRTaXplKSB7XG4gICAgICAgICAgc2l6ZSA9IGNhbGN1bGF0ZWRTaXplO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbykge1xuICAgICAgICB2YXIgY29sb3IgPSB0aGlzLmdldENvbG9yKGdlb2pzb24sIHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pO1xuICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbENvbG9yID0gdGhpcy5jb2xvclZhbHVlKGNvbG9yKTtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUoY29sb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlQTVMnKSB7XG4gICAgICB2YXIgbGF5ZXJPcHRpb25zID0gTC5leHRlbmQoe30sIHtpY29uOiB0aGlzLl9nZXRJY29uKHNpemUpfSwgb3B0aW9ucyk7XG4gICAgICByZXR1cm4gTC5tYXJrZXIobGF0bG5nLCBsYXllck9wdGlvbnMpO1xuICAgIH1cbiAgICBzaXplID0gdGhpcy5waXhlbFZhbHVlKHNpemUpO1xuXG4gICAgc3dpdGNoICh0aGlzLl9zeW1ib2xKc29uLnN0eWxlKSB7XG4gICAgICBjYXNlICdlc3JpU01TU3F1YXJlJzpcbiAgICAgICAgcmV0dXJuIHNxdWFyZU1hcmtlcihsYXRsbmcsIHNpemUsIEwuZXh0ZW5kKHt9LCB0aGlzLl9zdHlsZXMsIG9wdGlvbnMpKTtcbiAgICAgIGNhc2UgJ2VzcmlTTVNEaWFtb25kJzpcbiAgICAgICAgcmV0dXJuIGRpYW1vbmRNYXJrZXIobGF0bG5nLCBzaXplLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gICAgICBjYXNlICdlc3JpU01TQ3Jvc3MnOlxuICAgICAgICByZXR1cm4gY3Jvc3NNYXJrZXIobGF0bG5nLCBzaXplLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gICAgICBjYXNlICdlc3JpU01TWCc6XG4gICAgICAgIHJldHVybiB4TWFya2VyKGxhdGxuZywgc2l6ZSwgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICAgIH1cbiAgICB0aGlzLl9zdHlsZXMucmFkaXVzID0gc2l6ZSAvIDIuMDtcbiAgICByZXR1cm4gTC5jaXJjbGVNYXJrZXIobGF0bG5nLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gcG9pbnRTeW1ib2wgKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBQb2ludFN5bWJvbChzeW1ib2xKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9pbnRTeW1ib2w7XG4iLCJpbXBvcnQgU3ltYm9sIGZyb20gJy4vU3ltYm9sJztcblxuZXhwb3J0IHZhciBMaW5lU3ltYm9sID0gU3ltYm9sLmV4dGVuZCh7XG4gIHN0YXRpY3M6IHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWQgJ2VzcmlTTFNOdWxsJ1xuICAgIExJTkVUWVBFUzogWydlc3JpU0xTRGFzaCcsICdlc3JpU0xTRG90JywgJ2VzcmlTTFNEYXNoRG90RG90JywgJ2VzcmlTTFNEYXNoRG90JywgJ2VzcmlTTFNTb2xpZCddXG4gIH0sXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gICAgU3ltYm9sLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fZmlsbFN0eWxlcygpO1xuICB9LFxuXG4gIF9maWxsU3R5bGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gc2V0IHRoZSBkZWZhdWx0cyB0aGF0IHNob3cgdXAgb24gYXJjZ2lzIG9ubGluZVxuICAgIHRoaXMuX3N0eWxlcy5saW5lQ2FwID0gJ2J1dHQnO1xuICAgIHRoaXMuX3N0eWxlcy5saW5lSm9pbiA9ICdtaXRlcic7XG4gICAgdGhpcy5fc3R5bGVzLmZpbGwgPSBmYWxzZTtcbiAgICB0aGlzLl9zdHlsZXMud2VpZ2h0ID0gMDtcblxuICAgIGlmICghdGhpcy5fc3ltYm9sSnNvbikge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0eWxlcztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5jb2xvcikge1xuICAgICAgdGhpcy5fc3R5bGVzLmNvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgICAgdGhpcy5fc3R5bGVzLm9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgfVxuXG4gICAgaWYgKCFpc05hTih0aGlzLl9zeW1ib2xKc29uLndpZHRoKSkge1xuICAgICAgdGhpcy5fc3R5bGVzLndlaWdodCA9IHRoaXMucGl4ZWxWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLndpZHRoKTtcblxuICAgICAgdmFyIGRhc2hWYWx1ZXMgPSBbXTtcblxuICAgICAgc3dpdGNoICh0aGlzLl9zeW1ib2xKc29uLnN0eWxlKSB7XG4gICAgICAgIGNhc2UgJ2VzcmlTTFNEYXNoJzpcbiAgICAgICAgICBkYXNoVmFsdWVzID0gWzQsIDNdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlc3JpU0xTRG90JzpcbiAgICAgICAgICBkYXNoVmFsdWVzID0gWzEsIDNdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlc3JpU0xTRGFzaERvdCc6XG4gICAgICAgICAgZGFzaFZhbHVlcyA9IFs4LCAzLCAxLCAzXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZXNyaVNMU0Rhc2hEb3REb3QnOlxuICAgICAgICAgIGRhc2hWYWx1ZXMgPSBbOCwgMywgMSwgMywgMSwgM107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIHVzZSB0aGUgZGFzaCB2YWx1ZXMgYW5kIHRoZSBsaW5lIHdlaWdodCB0byBzZXQgZGFzaCBhcnJheVxuICAgICAgaWYgKGRhc2hWYWx1ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhc2hWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBkYXNoVmFsdWVzW2ldICo9IHRoaXMuX3N0eWxlcy53ZWlnaHQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdHlsZXMuZGFzaEFycmF5ID0gZGFzaFZhbHVlcy5qb2luKCcsJyk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHN0eWxlOiBmdW5jdGlvbiAoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzKSB7XG4gICAgaWYgKCF0aGlzLl9pc0RlZmF1bHQgJiYgdmlzdWFsVmFyaWFibGVzKSB7XG4gICAgICBpZiAodmlzdWFsVmFyaWFibGVzLnNpemVJbmZvKSB7XG4gICAgICAgIHZhciBjYWxjdWxhdGVkU2l6ZSA9IHRoaXMucGl4ZWxWYWx1ZSh0aGlzLmdldFNpemUoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzLnNpemVJbmZvKSk7XG4gICAgICAgIGlmIChjYWxjdWxhdGVkU2l6ZSkge1xuICAgICAgICAgIHRoaXMuX3N0eWxlcy53ZWlnaHQgPSBjYWxjdWxhdGVkU2l6ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pIHtcbiAgICAgICAgdmFyIGNvbG9yID0gdGhpcy5nZXRDb2xvcihmZWF0dXJlLCB2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKTtcbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLmNvbG9yID0gdGhpcy5jb2xvclZhbHVlKGNvbG9yKTtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMub3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZShjb2xvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0eWxlcztcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBsaW5lU3ltYm9sIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgTGluZVN5bWJvbChzeW1ib2xKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgbGluZVN5bWJvbDtcbiIsImltcG9ydCBTeW1ib2wgZnJvbSAnLi9TeW1ib2wnO1xuaW1wb3J0IGxpbmVTeW1ib2wgZnJvbSAnLi9MaW5lU3ltYm9sJztcblxuZXhwb3J0IHZhciBQb2x5Z29uU3ltYm9sID0gU3ltYm9sLmV4dGVuZCh7XG4gIHN0YXRpY3M6IHtcbiAgICAvLyBub3QgaW1wbGVtZW50ZWQ6ICdlc3JpU0ZTQmFja3dhcmREaWFnb25hbCcsJ2VzcmlTRlNDcm9zcycsJ2VzcmlTRlNEaWFnb25hbENyb3NzJywnZXNyaVNGU0ZvcndhcmREaWFnb25hbCcsJ2VzcmlTRlNIb3Jpem9udGFsJywnZXNyaVNGU051bGwnLCdlc3JpU0ZTVmVydGljYWwnXG4gICAgUE9MWUdPTlRZUEVTOiBbJ2VzcmlTRlNTb2xpZCddXG4gIH0sXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gICAgU3ltYm9sLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG4gICAgaWYgKHN5bWJvbEpzb24pIHtcbiAgICAgIHRoaXMuX2xpbmVTdHlsZXMgPSBsaW5lU3ltYm9sKHN5bWJvbEpzb24ub3V0bGluZSwgb3B0aW9ucykuc3R5bGUoKTtcbiAgICAgIHRoaXMuX2ZpbGxTdHlsZXMoKTtcbiAgICB9XG4gIH0sXG5cbiAgX2ZpbGxTdHlsZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fbGluZVN0eWxlcykge1xuICAgICAgaWYgKHRoaXMuX2xpbmVTdHlsZXMud2VpZ2h0ID09PSAwKSB7XG4gICAgICAgIC8vIHdoZW4gd2VpZ2h0IGlzIDAsIHNldHRpbmcgdGhlIHN0cm9rZSB0byBmYWxzZSBjYW4gc3RpbGwgbG9vayBiYWRcbiAgICAgICAgLy8gKGdhcHMgYmV0d2VlbiB0aGUgcG9seWdvbnMpXG4gICAgICAgIHRoaXMuX3N0eWxlcy5zdHJva2UgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNvcHkgdGhlIGxpbmUgc3ltYm9sIHN0eWxlcyBpbnRvIHRoaXMgc3ltYm9sJ3Mgc3R5bGVzXG4gICAgICAgIGZvciAodmFyIHN0eWxlQXR0ciBpbiB0aGlzLl9saW5lU3R5bGVzKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzW3N0eWxlQXR0cl0gPSB0aGlzLl9saW5lU3R5bGVzW3N0eWxlQXR0cl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgdGhlIGZpbGwgZm9yIHRoZSBwb2x5Z29uXG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24pIHtcbiAgICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLmNvbG9yICYmXG4gICAgICAgICAgLy8gZG9uJ3QgZmlsbCBwb2x5Z29uIGlmIHR5cGUgaXMgbm90IHN1cHBvcnRlZFxuICAgICAgICAgIFBvbHlnb25TeW1ib2wuUE9MWUdPTlRZUEVTLmluZGV4T2YodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSA+PSAwKSkge1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsQ29sb3IgPSB0aGlzLmNvbG9yVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IDA7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHN0eWxlOiBmdW5jdGlvbiAoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzKSB7XG4gICAgaWYgKCF0aGlzLl9pc0RlZmF1bHQgJiYgdmlzdWFsVmFyaWFibGVzICYmIHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pIHtcbiAgICAgIHZhciBjb2xvciA9IHRoaXMuZ2V0Q29sb3IoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbyk7XG4gICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxDb2xvciA9IHRoaXMuY29sb3JWYWx1ZShjb2xvcik7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZShjb2xvcik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHlsZXM7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gcG9seWdvblN5bWJvbCAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFBvbHlnb25TeW1ib2woc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBvbHlnb25TeW1ib2w7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcblxuaW1wb3J0IHBvaW50U3ltYm9sIGZyb20gJy4uL1N5bWJvbHMvUG9pbnRTeW1ib2wnO1xuaW1wb3J0IGxpbmVTeW1ib2wgZnJvbSAnLi4vU3ltYm9scy9MaW5lU3ltYm9sJztcbmltcG9ydCBwb2x5Z29uU3ltYm9sIGZyb20gJy4uL1N5bWJvbHMvUG9seWdvblN5bWJvbCc7XG5cbmV4cG9ydCB2YXIgUmVuZGVyZXIgPSBMLkNsYXNzLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBwcm9wb3J0aW9uYWxQb2x5Z29uOiBmYWxzZSxcbiAgICBjbGlja2FibGU6IHRydWVcbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fcmVuZGVyZXJKc29uID0gcmVuZGVyZXJKc29uO1xuICAgIHRoaXMuX3BvaW50U3ltYm9scyA9IGZhbHNlO1xuICAgIHRoaXMuX3N5bWJvbHMgPSBbXTtcbiAgICB0aGlzLl92aXN1YWxWYXJpYWJsZXMgPSB0aGlzLl9wYXJzZVZpc3VhbFZhcmlhYmxlcyhyZW5kZXJlckpzb24udmlzdWFsVmFyaWFibGVzKTtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcbiAgfSxcblxuICBfcGFyc2VWaXN1YWxWYXJpYWJsZXM6IGZ1bmN0aW9uICh2aXN1YWxWYXJpYWJsZXMpIHtcbiAgICB2YXIgdmlzVmFycyA9IHt9O1xuICAgIGlmICh2aXN1YWxWYXJpYWJsZXMpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlzdWFsVmFyaWFibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZpc1ZhcnNbdmlzdWFsVmFyaWFibGVzW2ldLnR5cGVdID0gdmlzdWFsVmFyaWFibGVzW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmlzVmFycztcbiAgfSxcblxuICBfY3JlYXRlRGVmYXVsdFN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24uZGVmYXVsdFN5bWJvbCkge1xuICAgICAgdGhpcy5fZGVmYXVsdFN5bWJvbCA9IHRoaXMuX25ld1N5bWJvbCh0aGlzLl9yZW5kZXJlckpzb24uZGVmYXVsdFN5bWJvbCk7XG4gICAgICB0aGlzLl9kZWZhdWx0U3ltYm9sLl9pc0RlZmF1bHQgPSB0cnVlO1xuICAgIH1cbiAgfSxcblxuICBfbmV3U3ltYm9sOiBmdW5jdGlvbiAoc3ltYm9sSnNvbikge1xuICAgIGlmIChzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpU01TJyB8fCBzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpUE1TJykge1xuICAgICAgdGhpcy5fcG9pbnRTeW1ib2xzID0gdHJ1ZTtcbiAgICAgIHJldHVybiBwb2ludFN5bWJvbChzeW1ib2xKc29uLCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbiAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVNMUycpIHtcbiAgICAgIHJldHVybiBsaW5lU3ltYm9sKHN5bWJvbEpzb24sIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuICAgIGlmIChzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpU0ZTJykge1xuICAgICAgcmV0dXJuIHBvbHlnb25TeW1ib2woc3ltYm9sSnNvbiwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIC8vIG92ZXJyaWRlXG4gIH0sXG5cbiAgYXR0YWNoU3R5bGVzVG9MYXllcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgaWYgKHRoaXMuX3BvaW50U3ltYm9scykge1xuICAgICAgbGF5ZXIub3B0aW9ucy5wb2ludFRvTGF5ZXIgPSBMLlV0aWwuYmluZCh0aGlzLnBvaW50VG9MYXllciwgdGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxheWVyLm9wdGlvbnMuc3R5bGUgPSBMLlV0aWwuYmluZCh0aGlzLnN0eWxlLCB0aGlzKTtcbiAgICAgIGxheWVyLl9vcmlnaW5hbFN0eWxlID0gbGF5ZXIub3B0aW9ucy5zdHlsZTtcbiAgICB9XG4gIH0sXG5cbiAgcG9pbnRUb0xheWVyOiBmdW5jdGlvbiAoZ2VvanNvbiwgbGF0bG5nKSB7XG4gICAgdmFyIHN5bSA9IHRoaXMuX2dldFN5bWJvbChnZW9qc29uKTtcbiAgICBpZiAoc3ltICYmIHN5bS5wb2ludFRvTGF5ZXIpIHtcbiAgICAgIC8vIHJpZ2h0IG5vdyBjdXN0b20gcGFuZXMgYXJlIHRoZSBvbmx5IG9wdGlvbiBwdXNoZWQgdGhyb3VnaFxuICAgICAgcmV0dXJuIHN5bS5wb2ludFRvTGF5ZXIoZ2VvanNvbiwgbGF0bG5nLCB0aGlzLl92aXN1YWxWYXJpYWJsZXMsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuICAgIC8vIGludmlzaWJsZSBzeW1ib2xvZ3lcbiAgICByZXR1cm4gTC5jaXJjbGVNYXJrZXIobGF0bG5nLCB7cmFkaXVzOiAwLCBvcGFjaXR5OiAwfSk7XG4gIH0sXG5cbiAgc3R5bGU6IGZ1bmN0aW9uIChmZWF0dXJlKSB7XG4gICAgdmFyIHVzZXJTdHlsZXM7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VyRGVmaW5lZFN0eWxlKSB7XG4gICAgICB1c2VyU3R5bGVzID0gdGhpcy5vcHRpb25zLnVzZXJEZWZpbmVkU3R5bGUoZmVhdHVyZSk7XG4gICAgfVxuICAgIC8vIGZpbmQgdGhlIHN5bWJvbCB0byByZXByZXNlbnQgdGhpcyBmZWF0dXJlXG4gICAgdmFyIHN5bSA9IHRoaXMuX2dldFN5bWJvbChmZWF0dXJlKTtcbiAgICBpZiAoc3ltKSB7XG4gICAgICByZXR1cm4gdGhpcy5tZXJnZVN0eWxlcyhzeW0uc3R5bGUoZmVhdHVyZSwgdGhpcy5fdmlzdWFsVmFyaWFibGVzKSwgdXNlclN0eWxlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmlzaWJsZSBzeW1ib2xvZ3lcbiAgICAgIHJldHVybiB0aGlzLm1lcmdlU3R5bGVzKHtvcGFjaXR5OiAwLCBmaWxsT3BhY2l0eTogMH0sIHVzZXJTdHlsZXMpO1xuICAgIH1cbiAgfSxcblxuICBtZXJnZVN0eWxlczogZnVuY3Rpb24gKHN0eWxlcywgdXNlclN0eWxlcykge1xuICAgIHZhciBtZXJnZWRTdHlsZXMgPSB7fTtcbiAgICB2YXIgYXR0cjtcbiAgICAvLyBjb3B5IHJlbmRlcmVyIHN0eWxlIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGF0dHIgaW4gc3R5bGVzKSB7XG4gICAgICBpZiAoc3R5bGVzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIG1lcmdlZFN0eWxlc1thdHRyXSA9IHN0eWxlc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgd2l0aCB1c2VyIGRlZmluZWQgc3R5bGUgYXR0cmlidXRlc1xuICAgIGlmICh1c2VyU3R5bGVzKSB7XG4gICAgICBmb3IgKGF0dHIgaW4gdXNlclN0eWxlcykge1xuICAgICAgICBpZiAodXNlclN0eWxlcy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICAgIG1lcmdlZFN0eWxlc1thdHRyXSA9IHVzZXJTdHlsZXNbYXR0cl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1lcmdlZFN0eWxlcztcbiAgfVxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IFJlbmRlcmVyO1xuIiwiaW1wb3J0IFJlbmRlcmVyIGZyb20gJy4vUmVuZGVyZXInO1xuXG5leHBvcnQgdmFyIENsYXNzQnJlYWtzUmVuZGVyZXIgPSBSZW5kZXJlci5leHRlbmQoe1xuICBpbml0aWFsaXplOiBmdW5jdGlvbiAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gICAgUmVuZGVyZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCByZW5kZXJlckpzb24sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2ZpZWxkID0gdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkO1xuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24ubm9ybWFsaXphdGlvblR5cGUgJiYgdGhpcy5fcmVuZGVyZXJKc29uLm5vcm1hbGl6YXRpb25UeXBlID09PSAnZXNyaU5vcm1hbGl6ZUJ5RmllbGQnKSB7XG4gICAgICB0aGlzLl9ub3JtYWxpemF0aW9uRmllbGQgPSB0aGlzLl9yZW5kZXJlckpzb24ubm9ybWFsaXphdGlvbkZpZWxkO1xuICAgIH1cbiAgICB0aGlzLl9jcmVhdGVTeW1ib2xzKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVN5bWJvbHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3ltYm9sO1xuICAgIHZhciBjbGFzc2JyZWFrcyA9IHRoaXMuX3JlbmRlcmVySnNvbi5jbGFzc0JyZWFrSW5mb3M7XG5cbiAgICB0aGlzLl9zeW1ib2xzID0gW107XG5cbiAgICAvLyBjcmVhdGUgYSBzeW1ib2wgZm9yIGVhY2ggY2xhc3MgYnJlYWtcbiAgICBmb3IgKHZhciBpID0gY2xhc3NicmVha3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMucHJvcG9ydGlvbmFsUG9seWdvbiAmJiB0aGlzLl9yZW5kZXJlckpzb24uYmFja2dyb3VuZEZpbGxTeW1ib2wpIHtcbiAgICAgICAgc3ltYm9sID0gdGhpcy5fbmV3U3ltYm9sKHRoaXMuX3JlbmRlcmVySnNvbi5iYWNrZ3JvdW5kRmlsbFN5bWJvbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzeW1ib2wgPSB0aGlzLl9uZXdTeW1ib2woY2xhc3NicmVha3NbaV0uc3ltYm9sKTtcbiAgICAgIH1cbiAgICAgIHN5bWJvbC52YWwgPSBjbGFzc2JyZWFrc1tpXS5jbGFzc01heFZhbHVlO1xuICAgICAgdGhpcy5fc3ltYm9scy5wdXNoKHN5bWJvbCk7XG4gICAgfVxuICAgIC8vIHNvcnQgdGhlIHN5bWJvbHMgaW4gYXNjZW5kaW5nIHZhbHVlXG4gICAgdGhpcy5fc3ltYm9scy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYS52YWwgPiBiLnZhbCA/IDEgOiAtMTtcbiAgICB9KTtcbiAgICB0aGlzLl9jcmVhdGVEZWZhdWx0U3ltYm9sKCk7XG4gICAgdGhpcy5fbWF4VmFsdWUgPSB0aGlzLl9zeW1ib2xzW3RoaXMuX3N5bWJvbHMubGVuZ3RoIC0gMV0udmFsO1xuICB9LFxuXG4gIF9nZXRTeW1ib2w6IGZ1bmN0aW9uIChmZWF0dXJlKSB7XG4gICAgdmFyIHZhbCA9IGZlYXR1cmUucHJvcGVydGllc1t0aGlzLl9maWVsZF07XG4gICAgaWYgKHRoaXMuX25vcm1hbGl6YXRpb25GaWVsZCkge1xuICAgICAgdmFyIG5vcm1WYWx1ZSA9IGZlYXR1cmUucHJvcGVydGllc1t0aGlzLl9ub3JtYWxpemF0aW9uRmllbGRdO1xuICAgICAgaWYgKCFpc05hTihub3JtVmFsdWUpICYmIG5vcm1WYWx1ZSAhPT0gMCkge1xuICAgICAgICB2YWwgPSB2YWwgLyBub3JtVmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmYXVsdFN5bWJvbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodmFsID4gdGhpcy5fbWF4VmFsdWUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9kZWZhdWx0U3ltYm9sO1xuICAgIH1cbiAgICB2YXIgc3ltYm9sID0gdGhpcy5fc3ltYm9sc1swXTtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fc3ltYm9scy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHZhbCA+IHRoaXMuX3N5bWJvbHNbaV0udmFsKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgc3ltYm9sID0gdGhpcy5fc3ltYm9sc1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHN5bWJvbDtcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc0JyZWFrc1JlbmRlcmVyIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBDbGFzc0JyZWFrc1JlbmRlcmVyKHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzQnJlYWtzUmVuZGVyZXI7XG4iLCJpbXBvcnQgUmVuZGVyZXIgZnJvbSAnLi9SZW5kZXJlcic7XG5cbmV4cG9ydCB2YXIgVW5pcXVlVmFsdWVSZW5kZXJlciA9IFJlbmRlcmVyLmV4dGVuZCh7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgICBSZW5kZXJlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fZmllbGQgPSB0aGlzLl9yZW5kZXJlckpzb24uZmllbGQxO1xuICAgIHRoaXMuX2NyZWF0ZVN5bWJvbHMoKTtcbiAgfSxcblxuICBfY3JlYXRlU3ltYm9sczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzeW1ib2w7XG4gICAgdmFyIHVuaXF1ZXMgPSB0aGlzLl9yZW5kZXJlckpzb24udW5pcXVlVmFsdWVJbmZvcztcblxuICAgIC8vIGNyZWF0ZSBhIHN5bWJvbCBmb3IgZWFjaCB1bmlxdWUgdmFsdWVcbiAgICBmb3IgKHZhciBpID0gdW5pcXVlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgc3ltYm9sID0gdGhpcy5fbmV3U3ltYm9sKHVuaXF1ZXNbaV0uc3ltYm9sKTtcbiAgICAgIHN5bWJvbC52YWwgPSB1bmlxdWVzW2ldLnZhbHVlO1xuICAgICAgdGhpcy5fc3ltYm9scy5wdXNoKHN5bWJvbCk7XG4gICAgfVxuICAgIHRoaXMuX2NyZWF0ZURlZmF1bHRTeW1ib2woKTtcbiAgfSxcblxuICBfZ2V0U3ltYm9sOiBmdW5jdGlvbiAoZmVhdHVyZSkge1xuICAgIHZhciB2YWwgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fZmllbGRdO1xuICAgIC8vIGFjY3VtdWxhdGUgdmFsdWVzIGlmIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgZmllbGQgZGVmaW5lZFxuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24uZmllbGREZWxpbWl0ZXIgJiYgdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkMikge1xuICAgICAgdmFyIHZhbDIgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkMl07XG4gICAgICBpZiAodmFsMikge1xuICAgICAgICB2YWwgKz0gdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkRGVsaW1pdGVyICsgdmFsMjtcbiAgICAgICAgdmFyIHZhbDMgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkM107XG4gICAgICAgIGlmICh2YWwzKSB7XG4gICAgICAgICAgdmFsICs9IHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZERlbGltaXRlciArIHZhbDM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgc3ltYm9sID0gdGhpcy5fZGVmYXVsdFN5bWJvbDtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fc3ltYm9scy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgLy8gdXNpbmcgdGhlID09PSBvcGVyYXRvciBkb2VzIG5vdCB3b3JrIGlmIHRoZSBmaWVsZFxuICAgICAgLy8gb2YgdGhlIHVuaXF1ZSByZW5kZXJlciBpcyBub3QgYSBzdHJpbmdcbiAgICAgIC8qZXNsaW50LWRpc2FibGUgKi9cbiAgICAgIGlmICh0aGlzLl9zeW1ib2xzW2ldLnZhbCA9PSB2YWwpIHtcbiAgICAgICAgc3ltYm9sID0gdGhpcy5fc3ltYm9sc1tpXTtcbiAgICAgIH1cbiAgICAgIC8qZXNsaW50LWVuYWJsZSAqL1xuICAgIH1cbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHVuaXF1ZVZhbHVlUmVuZGVyZXIgKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFVuaXF1ZVZhbHVlUmVuZGVyZXIocmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdW5pcXVlVmFsdWVSZW5kZXJlcjtcbiIsImltcG9ydCBSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVyJztcblxuZXhwb3J0IHZhciBTaW1wbGVSZW5kZXJlciA9IFJlbmRlcmVyLmV4dGVuZCh7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgICBSZW5kZXJlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fY3JlYXRlU3ltYm9sKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24uc3ltYm9sKSB7XG4gICAgICB0aGlzLl9zeW1ib2xzLnB1c2godGhpcy5fbmV3U3ltYm9sKHRoaXMuX3JlbmRlcmVySnNvbi5zeW1ib2wpKTtcbiAgICB9XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9zeW1ib2xzWzBdO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNpbXBsZVJlbmRlcmVyIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBTaW1wbGVSZW5kZXJlcihyZW5kZXJlckpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBzaW1wbGVSZW5kZXJlcjtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5cclxuaW1wb3J0IHsgYXJjZ2lzVG9HZW9KU09OIH0gZnJvbSAnYXJjZ2lzLXRvLWdlb2pzb24tdXRpbHMnO1xyXG5pbXBvcnQgeyBjbGFzc0JyZWFrc1JlbmRlcmVyIH0gZnJvbSAnZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL0NsYXNzQnJlYWtzUmVuZGVyZXInO1xyXG5pbXBvcnQgeyB1bmlxdWVWYWx1ZVJlbmRlcmVyIH0gZnJvbSAnZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1VuaXF1ZVZhbHVlUmVuZGVyZXInO1xyXG5pbXBvcnQgeyBzaW1wbGVSZW5kZXJlciB9IGZyb20gJ2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlcic7XHJcblxyXG5leHBvcnQgdmFyIEZlYXR1cmVDb2xsZWN0aW9uID0gTC5HZW9KU09OLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgZGF0YToge30sIC8vIEVzcmkgRmVhdHVyZSBDb2xsZWN0aW9uIEpTT04gb3IgSXRlbSBJRFxyXG4gICAgb3BhY2l0eTogMSxcclxuICAgIHJlbmRlcmVyOiB7fVxyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXllcnMsIG9wdGlvbnMpIHtcclxuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLmRhdGEgPSB0aGlzLm9wdGlvbnMuZGF0YTtcclxuICAgIHRoaXMub3BhY2l0eSA9IHRoaXMub3B0aW9ucy5vcGFjaXR5O1xyXG4gICAgdGhpcy5yZW5kZXJlciA9IHRoaXMub3B0aW9ucy5yZW5kZXJlcjtcclxuICAgIHRoaXMuX2xheWVycyA9IHt9O1xyXG5cclxuICAgIHZhciBpLCBsZW47XHJcblxyXG4gICAgaWYgKGxheWVycykge1xyXG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSBsYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICB0aGlzLmFkZExheWVyKGxheWVyc1tpXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIHRoaXMuZGF0YSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgdGhpcy5fZ2V0RmVhdHVyZUNvbGxlY3Rpb24odGhpcy5kYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX3BhcnNlRmVhdHVyZUNvbGxlY3Rpb24odGhpcy5kYXRhKTtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBfZ2V0RmVhdHVyZUNvbGxlY3Rpb246IGZ1bmN0aW9uIChpdGVtSWQpIHtcclxuICAgIHZhciB1cmwgPSAnaHR0cHM6Ly93d3cuYXJjZ2lzLmNvbS9zaGFyaW5nL3Jlc3QvY29udGVudC9pdGVtcy8nICsgaXRlbUlkICsgJy9kYXRhJztcclxuICAgIEwuZXNyaS5yZXF1ZXN0KHVybCwge30sIGZ1bmN0aW9uIChlcnIsIHJlcykge1xyXG4gICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZXJyKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLl9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uKHJlcyk7XHJcbiAgICAgIH1cclxuICAgIH0sIHRoaXMpO1xyXG4gIH0sXHJcblxyXG4gIF9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgdmFyIGZlYXR1cmVzID0gZGF0YS5sYXllcnNbMF0uZmVhdHVyZVNldC5mZWF0dXJlcztcclxuICAgIHZhciBnZW9tZXRyeVR5cGUgPSBkYXRhLmxheWVyc1swXS5sYXllckRlZmluaXRpb24uZ2VvbWV0cnlUeXBlOyAvLyAnZXNyaUdlb21ldHJ5UG9pbnQnIHwgJ2VzcmlHZW9tZXRyeU11bHRpcG9pbnQnIHwgJ2VzcmlHZW9tZXRyeVBvbHlsaW5lJyB8ICdlc3JpR2VvbWV0cnlQb2x5Z29uJyB8ICdlc3JpR2VvbWV0cnlFbnZlbG9wZSdcclxuICAgIHZhciBvYmplY3RJZEZpZWxkID0gZGF0YS5sYXllcnNbMF0ubGF5ZXJEZWZpbml0aW9uLm9iamVjdElkRmllbGQ7XHJcblxyXG4gICAgaWYgKGRhdGEubGF5ZXJzWzBdLmxheWVyRGVmaW5pdGlvbi5leHRlbnQuc3BhdGlhbFJlZmVyZW5jZS53a2lkID09PSAxMDIxMDApIHtcclxuICAgICAgZmVhdHVyZXMgPSB0aGlzLl9wcm9qVG80MzI2KGZlYXR1cmVzLCBnZW9tZXRyeVR5cGUpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBnZW9qc29uID0gdGhpcy5fZmVhdHVyZUNvbGxlY3Rpb25Ub0dlb0pTT04oZmVhdHVyZXMsIG9iamVjdElkRmllbGQpO1xyXG5cclxuICAgIHRoaXMuX3NldFJlbmRlcmVycyhkYXRhLmxheWVyc1swXS5sYXllckRlZmluaXRpb24pO1xyXG4gICAgY29uc29sZS5sb2coZ2VvanNvbik7XHJcbiAgICB0aGlzLmFkZERhdGEoZ2VvanNvbik7XHJcbiAgfSxcclxuXHJcbiAgX3Byb2pUbzQzMjY6IGZ1bmN0aW9uIChmZWF0dXJlcywgZ2VvbWV0cnlUeXBlKSB7XHJcbiAgICBjb25zb2xlLmxvZygnX3Byb2plY3QhJyk7XHJcbiAgICB2YXIgaSwgbGVuO1xyXG4gICAgdmFyIHByb2pGZWF0dXJlcyA9IFtdO1xyXG5cclxuICAgIGZvciAoaSA9IDAsIGxlbiA9IGZlYXR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIHZhciBmID0gZmVhdHVyZXNbaV07XHJcbiAgICAgIHZhciBtZXJjYXRvclRvTGF0bG5nO1xyXG4gICAgICB2YXIgaiwgaztcclxuXHJcbiAgICAgIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2ludCcpIHtcclxuICAgICAgICBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGYuZ2VvbWV0cnkueCwgZi5nZW9tZXRyeS55KSk7XHJcbiAgICAgICAgZi5nZW9tZXRyeS54ID0gbWVyY2F0b3JUb0xhdGxuZy5sbmc7XHJcbiAgICAgICAgZi5nZW9tZXRyeS55ID0gbWVyY2F0b3JUb0xhdGxuZy5sYXQ7XHJcbiAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5TXVsdGlwb2ludCcpIHtcclxuICAgICAgICB2YXIgcGxlbjtcclxuXHJcbiAgICAgICAgZm9yIChqID0gMCwgcGxlbiA9IGYuZ2VvbWV0cnkucG9pbnRzLmxlbmd0aDsgaiA8IHBsZW47IGorKykge1xyXG4gICAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmLmdlb21ldHJ5LnBvaW50c1tqXVswXSwgZi5nZW9tZXRyeS5wb2ludHNbal1bMV0pKTtcclxuICAgICAgICAgIGYuZ2VvbWV0cnkucG9pbnRzW2pdWzBdID0gbWVyY2F0b3JUb0xhdGxuZy5sbmc7XHJcbiAgICAgICAgICBmLmdlb21ldHJ5LnBvaW50c1tqXVsxXSA9IG1lcmNhdG9yVG9MYXRsbmcubGF0O1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2x5bGluZScpIHtcclxuICAgICAgICB2YXIgcGF0aGxlbiwgcGF0aHNsZW47XHJcblxyXG4gICAgICAgIGZvciAoaiA9IDAsIHBhdGhzbGVuID0gZi5nZW9tZXRyeS5wYXRocy5sZW5ndGg7IGogPCBwYXRoc2xlbjsgaisrKSB7XHJcbiAgICAgICAgICBmb3IgKGsgPSAwLCBwYXRobGVuID0gZi5nZW9tZXRyeS5wYXRoc1tqXS5sZW5ndGg7IGsgPCBwYXRobGVuOyBrKyspIHtcclxuICAgICAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmLmdlb21ldHJ5LnBhdGhzW2pdW2tdWzBdLCBmLmdlb21ldHJ5LnBhdGhzW2pdW2tdWzFdKSk7XHJcbiAgICAgICAgICAgIGYuZ2VvbWV0cnkucGF0aHNbal1ba11bMF0gPSBtZXJjYXRvclRvTGF0bG5nLmxuZztcclxuICAgICAgICAgICAgZi5nZW9tZXRyeS5wYXRoc1tqXVtrXVsxXSA9IG1lcmNhdG9yVG9MYXRsbmcubGF0O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2x5Z29uJykge1xyXG4gICAgICAgIHZhciByaW5nbGVuLCByaW5nc2xlbjtcclxuXHJcbiAgICAgICAgZm9yIChqID0gMCwgcmluZ3NsZW4gPSBmLmdlb21ldHJ5LnJpbmdzLmxlbmd0aDsgaiA8IHJpbmdzbGVuOyBqKyspIHtcclxuICAgICAgICAgIGZvciAoayA9IDAsIHJpbmdsZW4gPSBmLmdlb21ldHJ5LnJpbmdzW2pdLmxlbmd0aDsgayA8IHJpbmdsZW47IGsrKykge1xyXG4gICAgICAgICAgICBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGYuZ2VvbWV0cnkucmluZ3Nbal1ba11bMF0sIGYuZ2VvbWV0cnkucmluZ3Nbal1ba11bMV0pKTtcclxuICAgICAgICAgICAgZi5nZW9tZXRyeS5yaW5nc1tqXVtrXVswXSA9IG1lcmNhdG9yVG9MYXRsbmcubG5nO1xyXG4gICAgICAgICAgICBmLmdlb21ldHJ5LnJpbmdzW2pdW2tdWzFdID0gbWVyY2F0b3JUb0xhdGxuZy5sYXQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHByb2pGZWF0dXJlcy5wdXNoKGYpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwcm9qRmVhdHVyZXM7XHJcbiAgfSxcclxuXHJcbiAgX2ZlYXR1cmVDb2xsZWN0aW9uVG9HZW9KU09OOiBmdW5jdGlvbiAoZmVhdHVyZXMsIG9iamVjdElkRmllbGQpIHtcclxuICAgIHZhciBnZW9qc29uRmVhdHVyZUNvbGxlY3Rpb24gPSB7XHJcbiAgICAgIHR5cGU6ICdGZWF0dXJlQ29sbGVjdGlvbicsXHJcbiAgICAgIGZlYXR1cmVzOiBbXVxyXG4gICAgfTtcclxuICAgIHZhciBmZWF0dXJlc0FycmF5ID0gW107XHJcbiAgICB2YXIgaSwgbGVuO1xyXG5cclxuICAgIGZvciAoaSA9IDAsIGxlbiA9IGZlYXR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIHZhciBnZW9qc29uID0gYXJjZ2lzVG9HZW9KU09OKGZlYXR1cmVzW2ldLCBvYmplY3RJZEZpZWxkKTtcclxuICAgICAgZmVhdHVyZXNBcnJheS5wdXNoKGdlb2pzb24pO1xyXG4gICAgfVxyXG5cclxuICAgIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbi5mZWF0dXJlcyA9IGZlYXR1cmVzQXJyYXk7XHJcblxyXG4gICAgcmV0dXJuIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbjtcclxuICB9LFxyXG5cclxuICBfY2hlY2tGb3JQcm9wb3J0aW9uYWxTeW1ib2xzOiBmdW5jdGlvbiAoZ2VvbWV0cnlUeXBlLCByZW5kZXJlcikge1xyXG4gICAgdGhpcy5faGFzUHJvcG9ydGlvbmFsU3ltYm9scyA9IGZhbHNlO1xyXG4gICAgaWYgKGdlb21ldHJ5VHlwZSA9PT0gJ2VzcmlHZW9tZXRyeVBvbHlnb24nKSB7XHJcbiAgICAgIGlmIChyZW5kZXJlci5iYWNrZ3JvdW5kRmlsbFN5bWJvbCkge1xyXG4gICAgICAgIHRoaXMuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSB0cnVlO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGNoZWNrIHRvIHNlZSBpZiB0aGUgZmlyc3Qgc3ltYm9sIGluIHRoZSBjbGFzc2JyZWFrcyBpcyBhIG1hcmtlciBzeW1ib2xcclxuICAgICAgaWYgKHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvcyAmJiByZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MubGVuZ3RoKSB7XHJcbiAgICAgICAgdmFyIHN5bSA9IHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvc1swXS5zeW1ib2w7XHJcbiAgICAgICAgaWYgKHN5bSAmJiAoc3ltLnR5cGUgPT09ICdlc3JpU01TJyB8fCBzeW0udHlwZSA9PT0gJ2VzcmlQTVMnKSkge1xyXG4gICAgICAgICAgdGhpcy5faGFzUHJvcG9ydGlvbmFsU3ltYm9scyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgX3NldFJlbmRlcmVyczogZnVuY3Rpb24gKGxheWVyRGVmaW5pdGlvbikge1xyXG4gICAgdmFyIHJlbmQ7XHJcbiAgICB2YXIgcmVuZGVyZXJJbmZvID0gdGhpcy5yZW5kZXJlcjtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMucGFuZSkge1xyXG4gICAgICBvcHRpb25zLnBhbmUgPSB0aGlzLm9wdGlvbnMucGFuZTtcclxuICAgIH1cclxuICAgIGlmIChsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8udHJhbnNwYXJlbmN5KSB7XHJcbiAgICAgIG9wdGlvbnMubGF5ZXJUcmFuc3BhcmVuY3kgPSBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8udHJhbnNwYXJlbmN5O1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHlsZSkge1xyXG4gICAgICBvcHRpb25zLnVzZXJEZWZpbmVkU3R5bGUgPSB0aGlzLm9wdGlvbnMuc3R5bGU7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoIChyZW5kZXJlckluZm8udHlwZSkge1xyXG4gICAgICBjYXNlICdjbGFzc0JyZWFrcyc6XHJcbiAgICAgICAgdGhpcy5fY2hlY2tGb3JQcm9wb3J0aW9uYWxTeW1ib2xzKGxheWVyRGVmaW5pdGlvbi5nZW9tZXRyeVR5cGUsIHJlbmRlcmVySW5mbyk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMpIHtcclxuICAgICAgICAgIHRoaXMuX2NyZWF0ZVBvaW50TGF5ZXIoKTtcclxuICAgICAgICAgIHZhciBwUmVuZCA9IGNsYXNzQnJlYWtzUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgICAgIHBSZW5kLmF0dGFjaFN0eWxlc1RvTGF5ZXIodGhpcy5fcG9pbnRMYXllcik7XHJcbiAgICAgICAgICBvcHRpb25zLnByb3BvcnRpb25hbFBvbHlnb24gPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZW5kID0gY2xhc3NCcmVha3NSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICd1bmlxdWVWYWx1ZSc6XHJcbiAgICAgICAgY29uc29sZS5sb2cocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgICByZW5kID0gdW5pcXVlVmFsdWVSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJlbmQgPSBzaW1wbGVSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gICAgfVxyXG4gICAgcmVuZC5hdHRhY2hTdHlsZXNUb0xheWVyKHRoaXMpO1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZmVhdHVyZUNvbGxlY3Rpb24gKGdlb2pzb24sIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IEZlYXR1cmVDb2xsZWN0aW9uKGdlb2pzb24sIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmZWF0dXJlQ29sbGVjdGlvbjtcclxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcblxyXG5leHBvcnQgdmFyIExhYmVsSWNvbiA9IEwuRGl2SWNvbi5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIGljb25TaXplOiBudWxsLFxyXG4gICAgY2xhc3NOYW1lOiAnZXNyaS1sZWFmbGV0LXdlYm1hcC1sYWJlbHMnLFxyXG4gICAgdGV4dDogJydcclxuICB9LFxyXG5cclxuICBjcmVhdGVJY29uOiBmdW5jdGlvbiAob2xkSWNvbikge1xyXG4gICAgdmFyIGRpdiA9IChvbGRJY29uICYmIG9sZEljb24udGFnTmFtZSA9PT0gJ0RJVicpID8gb2xkSWNvbiA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XHJcblxyXG4gICAgZGl2LmlubmVySFRNTCA9ICc8ZGl2IHN0eWxlPVwicG9zaXRpb246IHJlbGF0aXZlOyBsZWZ0OiAtNTAlOyB0ZXh0LXNoYWRvdzogMXB4IDFweCAwcHggI2ZmZiwgLTFweCAxcHggMHB4ICNmZmYsIDFweCAtMXB4IDBweCAjZmZmLCAtMXB4IC0xcHggMHB4ICNmZmY7XCI+JyArIG9wdGlvbnMudGV4dCArICc8L2Rpdj4nO1xyXG5cclxuICAgIC8vIGxhYmVsLmNzc1xyXG4gICAgZGl2LnN0eWxlLmZvbnRTaXplID0gJzFlbSc7XHJcbiAgICBkaXYuc3R5bGUuZm9udFdlaWdodCA9ICdib2xkJztcclxuICAgIGRpdi5zdHlsZS50ZXh0VHJhbnNmb3JtID0gJ3VwcGVyY2FzZSc7XHJcbiAgICBkaXYuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XHJcbiAgICBkaXYuc3R5bGUud2hpdGVTcGFjZSA9ICdub3dyYXAnO1xyXG5cclxuICAgIGlmIChvcHRpb25zLmJnUG9zKSB7XHJcbiAgICAgIHZhciBiZ1BvcyA9IEwucG9pbnQob3B0aW9ucy5iZ1Bvcyk7XHJcbiAgICAgIGRpdi5zdHlsZS5iYWNrZ3JvdW5kUG9zaXRpb24gPSAoLWJnUG9zLngpICsgJ3B4ICcgKyAoLWJnUG9zLnkpICsgJ3B4JztcclxuICAgIH1cclxuICAgIHRoaXMuX3NldEljb25TdHlsZXMoZGl2LCAnaWNvbicpO1xyXG5cclxuICAgIHJldHVybiBkaXY7XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsYWJlbEljb24gKG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IExhYmVsSWNvbihvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbGFiZWxJY29uO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuaW1wb3J0IHsgbGFiZWxJY29uIH0gZnJvbSAnLi9MYWJlbEljb24nO1xyXG5cclxuZXhwb3J0IHZhciBMYWJlbE1hcmtlciA9IEwuTWFya2VyLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgcHJvcGVydGllczoge30sXHJcbiAgICBsYWJlbGluZ0luZm86IHt9LFxyXG4gICAgb2Zmc2V0OiBbMCwgMF1cclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcbiAgICB0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xyXG5cclxuICAgIHZhciBsYWJlbFRleHQgPSB0aGlzLl9jcmVhdGVMYWJlbFRleHQodGhpcy5vcHRpb25zLnByb3BlcnRpZXMsIHRoaXMub3B0aW9ucy5sYWJlbGluZ0luZm8pO1xyXG4gICAgdGhpcy5fc2V0TGFiZWxJY29uKGxhYmVsVGV4dCwgdGhpcy5vcHRpb25zLm9mZnNldCk7XHJcbiAgfSxcclxuXHJcbiAgX2NyZWF0ZUxhYmVsVGV4dDogZnVuY3Rpb24gKHByb3BlcnRpZXMsIGxhYmVsaW5nSW5mbykge1xyXG4gICAgdmFyIHIgPSAvXFxbKFteXFxdXSopXFxdL2c7XHJcbiAgICB2YXIgbGFiZWxUZXh0ID0gbGFiZWxpbmdJbmZvWzBdLmxhYmVsRXhwcmVzc2lvbjtcclxuXHJcbiAgICBsYWJlbFRleHQgPSBsYWJlbFRleHQucmVwbGFjZShyLCBmdW5jdGlvbiAocykge1xyXG4gICAgICB2YXIgbSA9IHIuZXhlYyhzKTtcclxuICAgICAgcmV0dXJuIHByb3BlcnRpZXNbbVsxXV07XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbGFiZWxUZXh0O1xyXG4gIH0sXHJcblxyXG4gIF9zZXRMYWJlbEljb246IGZ1bmN0aW9uICh0ZXh0LCBvZmZzZXQpIHtcclxuICAgIHZhciBpY29uID0gbGFiZWxJY29uKHtcclxuICAgICAgdGV4dDogdGV4dCxcclxuICAgICAgaWNvbkFuY2hvcjogb2Zmc2V0XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNldEljb24oaWNvbik7XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsYWJlbE1hcmtlciAobGF0bG5nLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBMYWJlbE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBsYWJlbE1hcmtlcjtcclxuIiwiZXhwb3J0IGZ1bmN0aW9uIHBvaW50TGFiZWxQb3MgKGNvb3JkaW5hdGVzKSB7XHJcbiAgdmFyIGxhYmVsUG9zID0geyBwb3NpdGlvbjogW10sIG9mZnNldDogW10gfTtcclxuXHJcbiAgbGFiZWxQb3MucG9zaXRpb24gPSBjb29yZGluYXRlcy5yZXZlcnNlKCk7XHJcbiAgbGFiZWxQb3Mub2Zmc2V0ID0gWzIwLCAyMF07XHJcblxyXG4gIHJldHVybiBsYWJlbFBvcztcclxufVxyXG5cclxuZXhwb3J0IHZhciBQb2ludExhYmVsID0ge1xyXG4gIHBvaW50TGFiZWxQb3M6IHBvaW50TGFiZWxQb3NcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvaW50TGFiZWw7XHJcbiIsImV4cG9ydCBmdW5jdGlvbiBwb2x5bGluZUxhYmVsUG9zIChjb29yZGluYXRlcykge1xyXG4gIHZhciBsYWJlbFBvcyA9IHsgcG9zaXRpb246IFtdLCBvZmZzZXQ6IFtdIH07XHJcbiAgdmFyIGNlbnRyYWxLZXk7XHJcblxyXG4gIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGNvb3JkaW5hdGVzLmxlbmd0aCAvIDIpO1xyXG4gIGxhYmVsUG9zLnBvc2l0aW9uID0gY29vcmRpbmF0ZXNbY2VudHJhbEtleV0ucmV2ZXJzZSgpO1xyXG4gIGxhYmVsUG9zLm9mZnNldCA9IFswLCAwXTtcclxuXHJcbiAgcmV0dXJuIGxhYmVsUG9zO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIFBvbHlsaW5lTGFiZWwgPSB7XHJcbiAgcG9seWxpbmVMYWJlbFBvczogcG9seWxpbmVMYWJlbFBvc1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUG9seWxpbmVMYWJlbDtcclxuIiwiZXhwb3J0IGZ1bmN0aW9uIHBvbHlnb25MYWJlbFBvcyAobGF5ZXIsIGNvb3JkaW5hdGVzKSB7XHJcbiAgdmFyIGxhYmVsUG9zID0geyBwb3NpdGlvbjogW10sIG9mZnNldDogW10gfTtcclxuXHJcbiAgbGFiZWxQb3MucG9zaXRpb24gPSBsYXllci5nZXRCb3VuZHMoKS5nZXRDZW50ZXIoKTtcclxuICBsYWJlbFBvcy5vZmZzZXQgPSBbMCwgMF07XHJcblxyXG4gIHJldHVybiBsYWJlbFBvcztcclxufVxyXG5cclxuZXhwb3J0IHZhciBQb2x5Z29uTGFiZWwgPSB7XHJcbiAgcG9seWdvbkxhYmVsUG9zOiBwb2x5Z29uTGFiZWxQb3NcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvbHlnb25MYWJlbDtcclxuIiwiZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBvcHVwQ29udGVudCAocG9wdXBJbmZvLCBwcm9wZXJ0aWVzKSB7XHJcbiAgLy8gY29uc29sZS5sb2cocG9wdXBJbmZvLCBwcm9wZXJ0aWVzKTtcclxuICB2YXIgciA9IC9cXHsoW15cXF1dKilcXH0vZztcclxuICB2YXIgdGl0bGVUZXh0ID0gJyc7XHJcbiAgdmFyIGNvbnRlbnQgPSAnJztcclxuXHJcbiAgaWYgKHBvcHVwSW5mby50aXRsZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICB0aXRsZVRleHQgPSBwb3B1cEluZm8udGl0bGU7XHJcbiAgfVxyXG5cclxuICB0aXRsZVRleHQgPSB0aXRsZVRleHQucmVwbGFjZShyLCBmdW5jdGlvbiAocykge1xyXG4gICAgdmFyIG0gPSByLmV4ZWMocyk7XHJcbiAgICByZXR1cm4gcHJvcGVydGllc1ttWzFdXTtcclxuICB9KTtcclxuXHJcbiAgY29udGVudCA9ICc8ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LXRpdGxlXCI+PGg0PicgKyB0aXRsZVRleHQgKyAnPC9oND48L2Rpdj48ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LWRlc2NyaXB0aW9uXCIgc3R5bGU9XCJtYXgtaGVpZ2h0OjIwMHB4O292ZXJmbG93OmF1dG87XCI+JztcclxuXHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb3B1cEluZm8uZmllbGRJbmZvcy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLnZpc2libGUgPT09IHRydWUpIHtcclxuICAgICAgY29udGVudCArPSAnPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OmJvbGQ7Y29sb3I6Izk5OTttYXJnaW4tdG9wOjVweDt3b3JkLWJyZWFrOmJyZWFrLWFsbDtcIj4nICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWwgKyAnPC9kaXY+PHAgc3R5bGU9XCJtYXJnaW4tdG9wOjA7bWFyZ2luLWJvdHRvbTo1cHg7d29yZC1icmVhazpicmVhay1hbGw7XCI+JyArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXSArICc8L3A+JztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnRlbnQgKz0gJzwvZGl2Pic7XHJcblxyXG4gIGlmIChwb3B1cEluZm8ubWVkaWFJbmZvcy5sZW5ndGggPiAwKSB7XHJcbiAgICAvLyBJdCBkb2VzIG5vdCBzdXBwb3J0IG1lZGlhSW5mb3MgZm9yIHBvcHVwIGNvbnRlbnRzLlxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGNvbnRlbnQ7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgUG9wdXAgPSB7XHJcbiAgY3JlYXRlUG9wdXBDb250ZW50OiBjcmVhdGVQb3B1cENvbnRlbnRcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvcHVwO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuaW1wb3J0IHsgZmVhdHVyZUNvbGxlY3Rpb24gfSBmcm9tICcuL0ZlYXR1cmVDb2xsZWN0aW9uL0ZlYXR1cmVDb2xsZWN0aW9uJztcclxuaW1wb3J0IHsgbGFiZWxNYXJrZXIgfSBmcm9tICcuL0xhYmVsL0xhYmVsTWFya2VyJztcclxuaW1wb3J0IHsgcG9pbnRMYWJlbFBvcyB9IGZyb20gJy4vTGFiZWwvUG9pbnRMYWJlbCc7XHJcbmltcG9ydCB7IHBvbHlsaW5lTGFiZWxQb3MgfSBmcm9tICcuL0xhYmVsL1BvbHlsaW5lTGFiZWwnO1xyXG5pbXBvcnQgeyBwb2x5Z29uTGFiZWxQb3MgfSBmcm9tICcuL0xhYmVsL1BvbHlnb25MYWJlbCc7XHJcbmltcG9ydCB7IGNyZWF0ZVBvcHVwQ29udGVudCB9IGZyb20gJy4vUG9wdXAvUG9wdXAnO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZXJhdGlvbmFsTGF5ZXIgKGxheWVyLCBsYXllcnMsIG1hcCwgcGFuZU5hbWUpIHtcclxuICByZXR1cm4gX2dlbmVyYXRlRXNyaUxheWVyKGxheWVyLCBsYXllcnMsIG1hcCwgcGFuZU5hbWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX2dlbmVyYXRlRXNyaUxheWVyIChsYXllciwgbGF5ZXJzLCBtYXAsIHBhbmVOYW1lKSB7XHJcbiAgY29uc29sZS5sb2coJ2dlbmVyYXRlRXNyaUxheWVyOiAnLCBsYXllci50aXRsZSwgbGF5ZXIpO1xyXG4gIHZhciBseXI7XHJcbiAgdmFyIGxhYmVscyA9IFtdO1xyXG4gIHZhciBsYWJlbHNMYXllcjtcclxuICB2YXIgbGFiZWxQYW5lTmFtZSA9IHBhbmVOYW1lICsgJy1sYWJlbCc7XHJcblxyXG4gIGlmIChsYXllci5mZWF0dXJlQ29sbGVjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICBjb25zb2xlLmxvZygnY3JlYXRlIEZlYXR1cmVDb2xsZWN0aW9uJyk7XHJcblxyXG4gICAgbWFwLmNyZWF0ZVBhbmUobGFiZWxQYW5lTmFtZSk7XHJcblxyXG4gICAgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG4gICAgbHlyID0gZmVhdHVyZUNvbGxlY3Rpb24oW10sIHtcclxuICAgICAgZGF0YTogbGF5ZXIuaXRlbUlkIHx8IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5LFxyXG4gICAgICByZW5kZXJlcjogbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzWzBdLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlcixcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgaWYgKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbMF0ucG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHZhciBsYWJlbGluZ0luZm8gPSBsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbMF0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgICAgICAgIHZhciBjb29yZGluYXRlcyA9IGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcclxuICAgICAgICAgIHZhciBsYWJlbFBvcztcclxuXHJcbiAgICAgICAgICBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2ludExhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzW01hdGgucm91bmQoY29vcmRpbmF0ZXMubGVuZ3RoIC8gMildKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWdvbkxhYmVsUG9zKGwpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHZhciBsYWJlbCA9IGxhYmVsTWFya2VyKGxhYmVsUG9zLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgIHpJbmRleE9mZnNldDogMSxcclxuICAgICAgICAgICAgcHJvcGVydGllczogZ2VvanNvbi5wcm9wZXJ0aWVzLFxyXG4gICAgICAgICAgICBsYWJlbGluZ0luZm86IGxhYmVsaW5nSW5mbyxcclxuICAgICAgICAgICAgb2Zmc2V0OiBsYWJlbFBvcy5vZmZzZXQsXHJcbiAgICAgICAgICAgIHBhbmU6IGxhYmVsUGFuZU5hbWVcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGxhYmVsc0xheWVyLmFkZExheWVyKGxhYmVsKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGx5ciA9IEwubGF5ZXJHcm91cChbbHlyLCBsYWJlbHNMYXllcl0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZDJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci50eXBlID09PSAnRmVhdHVyZSBDb2xsZWN0aW9uJykge1xyXG4gICAgY29uc29sZS5sb2coJ2NyZWF0ZSBGZWF0dXJlQ29sbGVjdGlvbiB3aXRob3V0IGZlYXR1cmVDb2xsZWN0aW9uIHByb3BlcnR5Jyk7XHJcbiAgICBseXIgPSBmZWF0dXJlQ29sbGVjdGlvbihbXSwge1xyXG4gICAgICBkYXRhOiBsYXllci5pdGVtSWQsXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTRmVhdHVyZUxheWVyJyAmJiBsYXllci5sYXllckRlZmluaXRpb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgdmFyIHdoZXJlID0gJzE9MSc7XHJcbiAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci50eXBlID09PSAnaGVhdG1hcCcpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEhlYXRtYXBMYXllcicpO1xyXG4gICAgICAgIHZhciBncmFkaWVudCA9IHt9O1xyXG5cclxuICAgICAgICBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuY29sb3JTdG9wcy5tYXAoZnVuY3Rpb24gKHN0b3ApIHtcclxuICAgICAgICAgIC8vIGdyYWRpZW50W3N0b3AucmF0aW9dID0gJ3JnYmEoJyArIHN0b3AuY29sb3JbMF0gKyAnLCcgKyBzdG9wLmNvbG9yWzFdICsgJywnICsgc3RvcC5jb2xvclsyXSArICcsJyArIChzdG9wLmNvbG9yWzNdLzI1NSkgKyAnKSc7XHJcbiAgICAgICAgICAvLyBncmFkaWVudFtNYXRoLnJvdW5kKHN0b3AucmF0aW8qMTAwKS8xMDBdID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xyXG4gICAgICAgICAgZ3JhZGllbnRbKE1hdGgucm91bmQoc3RvcC5yYXRpbyAqIDEwMCkgLyAxMDAgKyA2KSAvIDddID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBseXIgPSBMLmVzcmkuSGVhdC5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDIuMFxyXG4gICAgICAgIC8vIGx5ciA9IEwuZXNyaS5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDEuMFxyXG4gICAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgICBtaW5PcGFjaXR5OiAwLjUsXHJcbiAgICAgICAgICBtYXg6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5tYXhQaXhlbEludGVuc2l0eSxcclxuICAgICAgICAgIGJsdXI6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5ibHVyUmFkaXVzLFxyXG4gICAgICAgICAgcmFkaXVzOiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuYmx1clJhZGl1cyAqIDEuMyxcclxuICAgICAgICAgIGdyYWRpZW50OiBncmFkaWVudCxcclxuICAgICAgICAgIHBhbmU6IHBhbmVOYW1lXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0hMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyICh3aXRoIGxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mbyknKTtcclxuICAgICAgICB2YXIgZHJhd2luZ0luZm8gPSBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm87XHJcbiAgICAgICAgZHJhd2luZ0luZm8udHJhbnNwYXJlbmN5ID0gMTAwIC0gKGxheWVyLm9wYWNpdHkgKiAxMDApO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeSk7XHJcblxyXG4gICAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgd2hlcmUgPSBsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBtYXAuY3JlYXRlUGFuZShsYWJlbFBhbmVOYW1lKTtcclxuXHJcbiAgICAgICAgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG5cclxuICAgICAgICBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcclxuICAgICAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICAgICAgd2hlcmU6IHdoZXJlLFxyXG4gICAgICAgICAgZHJhd2luZ0luZm86IGRyYXdpbmdJbmZvLFxyXG4gICAgICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgICBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICB2YXIgbGFiZWxpbmdJbmZvID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgICAgICAgICAgICB2YXIgY29vcmRpbmF0ZXMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICAgICAgdmFyIGxhYmVsUG9zO1xyXG5cclxuICAgICAgICAgICAgICBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcclxuICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gcG9pbnRMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXNbTWF0aC5yb3VuZChjb29yZGluYXRlcy5sZW5ndGggLyAyKV0pO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlnb25MYWJlbFBvcyhsKTtcclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgIHZhciBsYWJlbCA9IGxhYmVsTWFya2VyKGxhYmVsUG9zLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBnZW9qc29uLnByb3BlcnRpZXMsXHJcbiAgICAgICAgICAgICAgICBsYWJlbGluZ0luZm86IGxhYmVsaW5nSW5mbyxcclxuICAgICAgICAgICAgICAgIG9mZnNldDogbGFiZWxQb3Mub2Zmc2V0LFxyXG4gICAgICAgICAgICAgICAgcGFuZTogbGFiZWxQYW5lTmFtZVxyXG4gICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICBsYWJlbHNMYXllci5hZGRMYXllcihsYWJlbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbHlyID0gTC5sYXllckdyb3VwKFtseXIsIGxhYmVsc0xheWVyXSk7XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllciAod2l0aG91dCBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8pJyk7XHJcblxyXG4gICAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICB3aGVyZSA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbjtcclxuICAgICAgfVxyXG5cclxuICAgICAgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XHJcbiAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgd2hlcmU6IHdoZXJlLFxyXG4gICAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgcmV0dXJuIGx5cjtcclxuICAgIH1cclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU0ZlYXR1cmVMYXllcicpIHtcclxuICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyJyk7XHJcbiAgICBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgIGlmIChsYXllci5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRkwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU0ltYWdlU2VydmljZUxheWVyJykge1xyXG4gICAgY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNJbWFnZVNlcnZpY2VMYXllcicpO1xyXG4gICAgbHlyID0gTC5lc3JpLmltYWdlTWFwTGF5ZXIoe1xyXG4gICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHkgfHwgMVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnSU1MJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNNYXBTZXJ2aWNlTGF5ZXInKSB7XHJcbiAgICBseXIgPSBMLmVzcmkuZHluYW1pY01hcExheWVyKHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5IHx8IDFcclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0RNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTVGlsZWRNYXBTZXJ2aWNlTGF5ZXInKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBseXIgPSBMLmVzcmkuYmFzZW1hcExheWVyKGxheWVyLnRpdGxlKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgbHlyID0gTC5lc3JpLnRpbGVkTWFwTGF5ZXIoe1xyXG4gICAgICAgIHVybDogbGF5ZXIudXJsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgTC5lc3JpLnJlcXVlc3QobGF5ZXIudXJsLCB7fSwgZnVuY3Rpb24gKGVyciwgcmVzKSB7XHJcbiAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdmFyIG1heFdpZHRoID0gKG1hcC5nZXRTaXplKCkueCAtIDU1KTtcclxuICAgICAgICAgIHZhciB0aWxlZEF0dHJpYnV0aW9uID0gJzxzcGFuIGNsYXNzPVwiZXNyaS1hdHRyaWJ1dGlvbnNcIiBzdHlsZT1cImxpbmUtaGVpZ2h0OjE0cHg7IHZlcnRpY2FsLWFsaWduOiAtM3B4OyB0ZXh0LW92ZXJmbG93OmVsbGlwc2lzOyB3aGl0ZS1zcGFjZTpub3dyYXA7IG92ZXJmbG93OmhpZGRlbjsgZGlzcGxheTppbmxpbmUtYmxvY2s7IG1heC13aWR0aDonICsgbWF4V2lkdGggKyAncHg7XCI+JyArIHJlcy5jb3B5cmlnaHRUZXh0ICsgJzwvc3Bhbj4nO1xyXG4gICAgICAgICAgbWFwLmF0dHJpYnV0aW9uQ29udHJvbC5hZGRBdHRyaWJ1dGlvbih0aWxlZEF0dHJpYnV0aW9uKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2xlYWZsZXQtdGlsZS1wYW5lJylbMF0uc3R5bGUub3BhY2l0eSA9IGxheWVyLm9wYWNpdHkgfHwgMTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdUTUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ09wZW5TdHJlZXRNYXAnKSB7XHJcbiAgICBseXIgPSBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xyXG4gICAgICBhdHRyaWJ1dGlvbjogJyZjb3B5OyA8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T3BlblN0cmVldE1hcDwvYT4gY29udHJpYnV0b3JzJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ1dlYlRpbGVkTGF5ZXInKSB7XHJcbiAgICB2YXIgbHlyVXJsID0gX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldChsYXllci50ZW1wbGF0ZVVybCk7XHJcbiAgICBseXIgPSBMLnRpbGVMYXllcihseXJVcmwsIHtcclxuICAgICAgYXR0cmlidXRpb246IGxheWVyLmNvcHlyaWdodFxyXG4gICAgfSk7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdsZWFmbGV0LXRpbGUtcGFuZScpWzBdLnN0eWxlLm9wYWNpdHkgPSBsYXllci5vcGFjaXR5IHx8IDE7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2Uge1xyXG4gICAgbHlyID0gTC5mZWF0dXJlR3JvdXAoW10pO1xyXG4gICAgY29uc29sZS5sb2coJ1Vuc3VwcG9ydGVkIExheWVyOiAnLCBsYXllcik7XHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXQgKHVybCkge1xyXG4gIHZhciBuZXdVcmwgPSB1cmw7XHJcblxyXG4gIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtsZXZlbH0vZywgJ3t6fScpO1xyXG4gIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtjb2x9L2csICd7eH0nKTtcclxuICBuZXdVcmwgPSBuZXdVcmwucmVwbGFjZSgvXFx7cm93fS9nLCAne3l9Jyk7XHJcblxyXG4gIHJldHVybiBuZXdVcmw7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgT3BlcmF0aW9uYWxMYXllciA9IHtcclxuICBvcGVyYXRpb25hbExheWVyOiBvcGVyYXRpb25hbExheWVyLFxyXG4gIF9nZW5lcmF0ZUVzcmlMYXllcjogX2dlbmVyYXRlRXNyaUxheWVyLFxyXG4gIF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXQ6IF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXRcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IE9wZXJhdGlvbmFsTGF5ZXI7XHJcbiIsIi8qXHJcbiAqIEwuZXNyaS5XZWJNYXBcclxuICogQSBsZWFmbGV0IHBsdWdpbiB0byBkaXNwbGF5IEFyY0dJUyBXZWIgTWFwLiBodHRwczovL2dpdGh1Yi5jb20veW51bm9rYXdhL0wuZXNyaS5XZWJNYXBcclxuICogKGMpIDIwMTYgWXVzdWtlIE51bm9rYXdhXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIGBgYGpzXHJcbiAqIHZhciB3ZWJtYXAgPSBMLndlYm1hcCgnMjJjNTA0ZDIyOWYxNGM3ODljNWI0OWViZmYzOGI5NDEnLCB7IG1hcDogTC5tYXAoJ21hcCcpIH0pO1xyXG4gKiBgYGBcclxuICovXHJcblxyXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi4vcGFja2FnZS5qc29uJztcclxuXHJcbmltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5pbXBvcnQgeyBvcGVyYXRpb25hbExheWVyIH0gZnJvbSAnLi9PcGVyYXRpb25hbExheWVyJztcclxuXHJcbmV4cG9ydCB2YXIgV2ViTWFwID0gTC5FdmVudGVkLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgLy8gTC5NYXBcclxuICAgIG1hcDoge30sXHJcbiAgICAvLyBhY2Nlc3MgdG9rZW4gZm9yIHNlY3VyZSBjb250ZW50cyBvbiBBcmNHSVMgT25saW5lXHJcbiAgICB0b2tlbjogbnVsbCxcclxuICAgIC8vIHNlcnZlciBkb21haW4gbmFtZSAoZGVmYXVsdD0gJ3d3dy5hcmNnaXMuY29tJylcclxuICAgIHNlcnZlcjogJ3d3dy5hcmNnaXMuY29tJ1xyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uICh3ZWJtYXBJZCwgb3B0aW9ucykge1xyXG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX21hcCA9IHRoaXMub3B0aW9ucy5tYXA7XHJcbiAgICB0aGlzLl90b2tlbiA9IHRoaXMub3B0aW9ucy50b2tlbjtcclxuICAgIHRoaXMuX3NlcnZlciA9IHRoaXMub3B0aW9ucy5zZXJ2ZXI7XHJcbiAgICB0aGlzLl93ZWJtYXBJZCA9IHdlYm1hcElkO1xyXG4gICAgdGhpcy5fbG9hZGVkID0gZmFsc2U7XHJcbiAgICB0aGlzLl9tZXRhZGF0YUxvYWRlZCA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMubGF5ZXJzID0gW107IC8vIENoZWNrIHRoZSBsYXllciB0eXBlcyBoZXJlIC0+IGh0dHBzOi8vZ2l0aHViLmNvbS95bnVub2thd2EvTC5lc3JpLldlYk1hcC93aWtpL0xheWVyLXR5cGVzXHJcbiAgICB0aGlzLnRpdGxlID0gJyc7IC8vIFdlYiBNYXAgVGl0bGVcclxuICAgIHRoaXMuYm9va21hcmtzID0gW107IC8vIFdlYiBNYXAgQm9va21hcmtzIC0+IFt7IG5hbWU6ICdCb29rbWFyayBuYW1lJywgYm91bmRzOiA8TC5sYXRMbmdCb3VuZHM+IH1dXHJcbiAgICB0aGlzLnBvcnRhbEl0ZW0gPSB7fTsgLy8gV2ViIE1hcCBNZXRhZGF0YVxyXG5cclxuICAgIHRoaXMuVkVSU0lPTiA9IHZlcnNpb247XHJcblxyXG4gICAgdGhpcy5fbG9hZFdlYk1hcE1ldGFEYXRhKHdlYm1hcElkKTtcclxuICAgIHRoaXMuX2xvYWRXZWJNYXAod2VibWFwSWQpO1xyXG4gIH0sXHJcblxyXG4gIF9sb2FkV2ViTWFwTWV0YURhdGE6IGZ1bmN0aW9uIChpZCkge1xyXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xyXG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcclxuICAgIHZhciB3ZWJtYXAgPSB0aGlzO1xyXG4gICAgdmFyIHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCA9ICdodHRwczovLycgKyB0aGlzLl9zZXJ2ZXIgKyAnL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZDtcclxuICAgIGlmICh0aGlzLl90b2tlbiAmJiB0aGlzLl90b2tlbi5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHBhcmFtcy50b2tlbiA9IHRoaXMuX3Rva2VuO1xyXG4gICAgfVxyXG5cclxuICAgIEwuZXNyaS5yZXF1ZXN0KHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCwgcGFyYW1zLCBmdW5jdGlvbiAoZXJyb3IsIHJlc3BvbnNlKSB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnV2ViTWFwIE1ldGFEYXRhOiAnLCByZXNwb25zZSk7XHJcbiAgICAgICAgd2VibWFwLnBvcnRhbEl0ZW0gPSByZXNwb25zZTtcclxuICAgICAgICB3ZWJtYXAudGl0bGUgPSByZXNwb25zZS50aXRsZTtcclxuICAgICAgICB3ZWJtYXAuX21ldGFkYXRhTG9hZGVkID0gdHJ1ZTtcclxuICAgICAgICB3ZWJtYXAuZmlyZSgnbWV0YWRhdGFMb2FkJyk7XHJcbiAgICAgICAgbWFwLmZpdEJvdW5kcyhbcmVzcG9uc2UuZXh0ZW50WzBdLnJldmVyc2UoKSwgcmVzcG9uc2UuZXh0ZW50WzFdLnJldmVyc2UoKV0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9LFxyXG5cclxuICBfbG9hZFdlYk1hcDogZnVuY3Rpb24gKGlkKSB7XHJcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xyXG4gICAgdmFyIGxheWVycyA9IHRoaXMubGF5ZXJzO1xyXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xyXG4gICAgdmFyIHdlYm1hcFJlcXVlc3RVcmwgPSAnaHR0cHM6Ly8nICsgdGhpcy5fc2VydmVyICsgJy9zaGFyaW5nL3Jlc3QvY29udGVudC9pdGVtcy8nICsgaWQgKyAnL2RhdGEnO1xyXG4gICAgaWYgKHRoaXMuX3Rva2VuICYmIHRoaXMuX3Rva2VuLmxlbmd0aCA+IDApIHtcclxuICAgICAgcGFyYW1zLnRva2VuID0gdGhpcy5fdG9rZW47XHJcbiAgICB9XHJcblxyXG4gICAgTC5lc3JpLnJlcXVlc3Qod2VibWFwUmVxdWVzdFVybCwgcGFyYW1zLCBmdW5jdGlvbiAoZXJyb3IsIHJlc3BvbnNlKSB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnV2ViTWFwOiAnLCByZXNwb25zZSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBCYXNlbWFwXHJcbiAgICAgICAgcmVzcG9uc2UuYmFzZU1hcC5iYXNlTWFwTGF5ZXJzLm1hcChmdW5jdGlvbiAoYmFzZU1hcExheWVyKSB7XHJcbiAgICAgICAgICB2YXIgbHlyID0gb3BlcmF0aW9uYWxMYXllcihiYXNlTWFwTGF5ZXIsIGxheWVycywgbWFwKS5hZGRUbyhtYXApO1xyXG4gICAgICAgICAgaWYgKGx5ciAhPT0gdW5kZWZpbmVkICYmIGJhc2VNYXBMYXllci52aXNpYmlsaXR5ID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIGx5ci5hZGRUbyhtYXApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgT3BlcmF0aW9uYWwgTGF5ZXJzXHJcbiAgICAgICAgcmVzcG9uc2Uub3BlcmF0aW9uYWxMYXllcnMubWFwKGZ1bmN0aW9uIChsYXllciwgaSkge1xyXG4gICAgICAgICAgdmFyIHBhbmVOYW1lID0gJ2Vzcmktd2VibWFwLWxheWVyJyArIGk7XHJcbiAgICAgICAgICBtYXAuY3JlYXRlUGFuZShwYW5lTmFtZSk7XHJcbiAgICAgICAgICB2YXIgbHlyID0gb3BlcmF0aW9uYWxMYXllcihsYXllciwgbGF5ZXJzLCBtYXAsIHBhbmVOYW1lKTtcclxuICAgICAgICAgIGlmIChseXIgIT09IHVuZGVmaW5lZCAmJiBsYXllci52aXNpYmlsaXR5ID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIGx5ci5hZGRUbyhtYXApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgQm9va21hcmtzXHJcbiAgICAgICAgaWYgKHJlc3BvbnNlLmJvb2ttYXJrcyAhPT0gdW5kZWZpbmVkICYmIHJlc3BvbnNlLmJvb2ttYXJrcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICByZXNwb25zZS5ib29rbWFya3MubWFwKGZ1bmN0aW9uIChib29rbWFyaykge1xyXG4gICAgICAgICAgICAvLyBFc3JpIEV4dGVudCBHZW9tZXRyeSB0byBMLmxhdExuZ0JvdW5kc1xyXG4gICAgICAgICAgICB2YXIgbm9ydGhFYXN0ID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGJvb2ttYXJrLmV4dGVudC54bWF4LCBib29rbWFyay5leHRlbnQueW1heCkpO1xyXG4gICAgICAgICAgICB2YXIgc291dGhXZXN0ID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGJvb2ttYXJrLmV4dGVudC54bWluLCBib29rbWFyay5leHRlbnQueW1pbikpO1xyXG4gICAgICAgICAgICB2YXIgYm91bmRzID0gTC5sYXRMbmdCb3VuZHMoc291dGhXZXN0LCBub3J0aEVhc3QpO1xyXG4gICAgICAgICAgICB0aGlzLmJvb2ttYXJrcy5wdXNoKHsgbmFtZTogYm9va21hcmsubmFtZSwgYm91bmRzOiBib3VuZHMgfSk7XHJcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fbG9hZGVkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnKTtcclxuICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdlYk1hcCAod2VibWFwSWQsIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IFdlYk1hcCh3ZWJtYXBJZCwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHdlYk1hcDtcclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Q0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBOztBQUVBLENBQUE7QUFDQSxDQUFBLFNBQVMsV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDNUIsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLENBQUEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdkIsQ0FBQSxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ25CLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQSxTQUFTLFNBQVMsRUFBRSxXQUFXLEVBQUU7QUFDakMsQ0FBQSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDekUsQ0FBQSxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckMsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBLFNBQVMsZUFBZSxFQUFFLFVBQVUsRUFBRTtBQUN0QyxDQUFBLEVBQUUsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2hCLENBQUEsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDWixDQUFBLEVBQUUsSUFBSSxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztBQUNsQyxDQUFBLEVBQUUsSUFBSSxHQUFHLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUEsRUFBRSxJQUFJLEdBQUcsQ0FBQztBQUNWLENBQUEsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNoQyxDQUFBLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDNUIsQ0FBQSxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuRCxDQUFBLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNkLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQSxTQUFTLHNCQUFzQixFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtBQUNqRCxDQUFBLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEYsQ0FBQSxFQUFFLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xGLENBQUEsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFakYsQ0FBQSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRTtBQUNoQixDQUFBLElBQUksSUFBSSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUN0QixDQUFBLElBQUksSUFBSSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQzs7QUFFdEIsQ0FBQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNsRCxDQUFBLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQSxTQUFTLG9CQUFvQixFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDckMsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN6QyxDQUFBLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzNDLENBQUEsTUFBTSxJQUFJLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDbEUsQ0FBQSxRQUFRLE9BQU8sSUFBSSxDQUFDO0FBQ3BCLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFBLENBQUM7O0FBRUQsQ0FBQTtBQUNBLENBQUEsU0FBUyx1QkFBdUIsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFO0FBQ3RELENBQUEsRUFBRSxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7QUFDdkIsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDdEUsQ0FBQSxJQUFJLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFBLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RSxDQUFBLFFBQVEs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Q0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDekQsQ0FBQSxRQUFRLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3JDLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSyxDQUFDLENBQUM7O0FBRVAsQ0FBQSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQ2xCLENBQUEsTUFBTSxjQUFjLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDdkMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDOztBQUV2QyxDQUFBLFFBQVEsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtBQUMzQixDQUFBLFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzFCLENBQUEsVUFBVSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxDQUFBLFNBQVM7O0FBRVQsQ0FBQSxRQUFRLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDdkUsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDL0QsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDL0QsQ0FBQSxVQUFVLEdBQUcs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