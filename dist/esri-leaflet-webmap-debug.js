/* esri-leaflet-webmap - v0.3.2 - Thu Jul 07 2016 14:53:47 GMT+0900 (東京 (標準時))
 * Copyright (c) 2016 Yusuke Nunokawa <nuno0825@gmail.com>
 * MIT */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet')) :
	typeof define === 'function' && define.amd ? define(['exports', 'leaflet'], factory) :
	(factory((global.L = global.L || {}, global.L.esri = global.L.esri || {}),global.L));
}(this, function (exports,L) { 'use strict';

	L = 'default' in L ? L['default'] : L;

	var version = "0.3.2";

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

	L.esri.FeatureLayer.addInitHook(function () {
	  if (this.options.ignoreRenderer) {
	    return;
	  }
	  var oldOnAdd = L.Util.bind(this.onAdd, this);
	  var oldUnbindPopup = L.Util.bind(this.unbindPopup, this);
	  var oldOnRemove = L.Util.bind(this.onRemove, this);
	  L.Util.bind(this.createNewLayer, this);

	  this.onAdd = function (map) {
	    this.metadata(function (error, response) {
	      if (error) {
	        console.warn('failed to load metadata from the service.');
	        return
	      } if (response && response.drawingInfo) {
	        if(this.options.drawingInfo) {
	          // allow L.esri.webmap (and others) to override service symbology with info provided in layer constructor
	          var serviceMetadata = response;
	          serviceMetadata.drawingInfo = this.options.drawingInfo;
	          this._setRenderers(serviceMetadata);
	        } else {
	          this._setRenderers(response);
	        }
	        this._setRenderers(response);
	        oldOnAdd(map);
	        this._addPointLayer(map);
	      }
	    }, this);
	  };

	  this.onRemove = function (map) {
	    oldOnRemove(map);
	    if (this._pointLayer) {
	      var pointLayers = this._pointLayer.getLayers();
	      for (var i in pointLayers) {
	        map.removeLayer(pointLayers[i]);
	      }
	    }
	  };

	  this.unbindPopup = function () {
	    oldUnbindPopup();
	    if (this._pointLayer) {
	      var pointLayers = this._pointLayer.getLayers();
	      for (var i in pointLayers) {
	        pointLayers[i].unbindPopup();
	      }
	    }
	  };

	  this._addPointLayer = function (map) {
	    if (this._pointLayer) {
	      this._pointLayer.addTo(map);
	      this._pointLayer.bringToFront();
	    }
	  };

	  this._createPointLayer = function () {
	    if (!this._pointLayer) {
	      this._pointLayer = L.geoJson();
	      // store the feature ids that have already been added to the map
	      this._pointLayerIds = {};

	      if (this._popup) {
	        var popupFunction = function (feature, layer) {
	          layer.bindPopup(this._popup(feature, layer), this._popupOptions);
	        };
	        this._pointLayer.options.onEachFeature = L.Util.bind(popupFunction, this);
	      }
	    }
	  };

	  this.createNewLayer = function (geojson) {
	    var fLayer = L.GeoJSON.geometryToLayer(geojson, this.options);

	    // add a point layer when the polygon is represented as proportional marker symbols
	    if (this._hasProportionalSymbols) {
	      var centroid = this.getPolygonCentroid(geojson.geometry.coordinates);
	      if (!(isNaN(centroid[0]) || isNaN(centroid[0]))) {
	        this._createPointLayer();

	        var featureId = geojson.id.toString();
	        // only add the feature if it does not already exist on the map
	        if (!this._pointLayerIds[featureId]) {
	          var pointjson = this.getPointJson(geojson, centroid);

	          this._pointLayer.addData(pointjson);
	          this._pointLayerIds[featureId] = true;
	        }

	        this._pointLayer.bringToFront();
	      }
	    }
	    return fLayer;
	  };

	  this.getPolygonCentroid = function (coordinates) {
	    var pts = coordinates[0][0];
	    if (pts.length === 2) {
	      pts = coordinates[0];
	    }

	    var twicearea = 0;
	    var x = 0;
	    var y = 0;
	    var nPts = pts.length;
	    var p1;
	    var p2;
	    var f;

	    for (var i = 0, j = nPts - 1; i < nPts; j = i++) {
	      p1 = pts[i]; p2 = pts[j];
	      twicearea += p1[0] * p2[1];
	      twicearea -= p1[1] * p2[0];
	      f = p1[0] * p2[1] - p2[0] * p1[1];
	      x += (p1[0] + p2[0]) * f;
	      y += (p1[1] + p2[1]) * f;
	    }
	    f = twicearea * 3;
	    return [x / f, y / f];
	  };

	  this.getPointJson = function (geojson, centroid) {
	    return {
	      type: 'Feature',
	      properties: geojson.properties,
	      id: geojson.id,
	      geometry: {
	        type: 'Point',
	        coordinates: [centroid[0], centroid[1]]
	      }
	    };
	  };

	  this._checkForProportionalSymbols = function (geometryType, renderer) {
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
	  };

	  this._setRenderers = function (geojson) {
	    var rend;
	    var rendererInfo = geojson.drawingInfo.renderer;

	    var options = {
	      url: this.options.url
	    };

	    if (this.options.token) {
	      options.token = this.options.token;
	    }
	    if (this.options.pane) {
	      options.pane = this.options.pane;
	    }
	    if (geojson.drawingInfo.transparency) {
	      options.layerTransparency = geojson.drawingInfo.transparency;
	    }
	    if (this.options.style) {
	      options.userDefinedStyle = this.options.style;
	    }

	    switch (rendererInfo.type) {
	      case 'classBreaks':
	        this._checkForProportionalSymbols(geojson.geometryType, rendererInfo);
	        if (this._hasProportionalSymbols) {
	          this._createPointLayer();
	          var pRend = classBreaksRenderer(rendererInfo, options);
	          pRend.attachStylesToLayer(this._pointLayer);
	          options.proportionalPolygon = true;
	        }
	        rend = classBreaksRenderer(rendererInfo, options);
	        break;
	      case 'uniqueValue':
	        rend = uniqueValueRenderer(rendererInfo, options);
	        break;
	      default:
	        rend = simpleRenderer(rendererInfo, options);
	    }
	    rend.attachStylesToLayer(this);
	  };

	  this.metadata(function (error, response) {
	    if (error) {
	      return;
	    } if (response && response.drawingInfo) {
	      // if drawingInfo from a webmap is supplied in the layer constructor, use that instead
	      if (this.options.drawingInfo) {
	        response.drawingInfo = this.options.drawingInfo;
	      }
	      this._setRenderers(response);
	    } if (this._alreadyAdded) {
	      this.setStyle(this._originalStyle);
	    }
	  }, this);
	});

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
	    var geojson = this._featureCollectionToGeoJSON(features, geometryType);

	    this._setRenderers(data.layers[0].layerDefinition);
	    this.addData(geojson);
	  },

	  _featureCollectionToGeoJSON: function (features, geometryType) {
	    var geojson = {
	      type: 'FeatureCollection',
	      features: []
	    };
	    var featuresArray = [];
	    var i, len;

	    for (i = 0, len = features.length; i < len; i++) {
	      var f;
	      var mercatorToLatlng, coordinates;
	      var j, k;

	      if (geometryType === 'esriGeometryPoint') {
	        mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(features[i].geometry.x, features[i].geometry.y));
	        coordinates = [mercatorToLatlng.lng, mercatorToLatlng.lat];

	        f = {
	          type: 'Feature',
	          geometry: { type: 'Point', coordinates: coordinates },
	          properties: features[i].attributes
	        };
	      } else if (geometryType === 'esriGeometryMultipoint') {
	        var plen;
	        var points = [];

	        for (j = 0, plen = features[i].geometry.points.length; j < plen; j++) {
	          mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(features[i].geometry.points[j][0], features[i].geometry.points[j][1]));
	          coordinates = [mercatorToLatlng.lng, mercatorToLatlng.lat];
	          points.push(coordinates);
	        }

	        f = {
	          type: 'Feature',
	          geometry: { type: 'MultiPoint', coordinates: points },
	          properties: features[i].attributes
	        };
	      } else if (geometryType === 'esriGeometryPolyline') {
	        var pathlen, pathslen;
	        var paths = [];

	        for (j = 0, pathslen = features[i].geometry.paths.length; j < pathslen; j++) {
	          var path = [];
	          for (k = 0, pathlen = features[i].geometry.paths[j].length; k < pathlen; k++) {
	            mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(features[i].geometry.paths[j][k][0], features[i].geometry.paths[j][k][1]));
	            coordinates = [mercatorToLatlng.lng, mercatorToLatlng.lat];
	            path.push(coordinates);
	          }
	          paths.push(path);
	        }

	        f = {
	          type: 'Feature',
	          geometry: { type: 'MultiLineString', coordinates: paths },
	          properties: features[i].attributes
	        };
	      } else if (geometryType === 'esriGeometryPolygon') {
	        var ringlen, ringslen;
	        var rings = [];

	        for (j = 0, ringslen = features[i].geometry.rings.length; j < ringslen; j++) {
	          var ring = [];
	          for (k = 0, ringlen = features[i].geometry.rings[j].length; k < ringlen; k++) {
	            mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(features[i].geometry.rings[j][k][0], features[i].geometry.rings[j][k][1]));
	            coordinates = [mercatorToLatlng.lng, mercatorToLatlng.lat];
	            ring.push(coordinates);
	          }
	          rings.push(ring);
	        }

	        f = {
	          type: 'Feature',
	          geometry: { type: 'MultiPolygon', coordinates: rings },
	          properties: features[i].attributes
	        };
	      } else if (geometryType === 'esriGeometryEnvelope') {

	      }

	      featuresArray.push(f);
	    }

	    geojson.features = featuresArray;

	    return geojson;
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
	    var icon = L.divIcon({
	      iconSize: null,
	      className: 'esri-leaflet-webmap-labels',
	      html: '<div>' + text + '</div>',
	      iconAnchor: offset
	    });

	    this.setIcon(icon);
	  }
	});

	function labelMarker (latlng, options) {
	  return new LabelMarker(latlng, options);
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

	function operationalLayer (layer, layers, map) {
	  return _generateEsriLayer(layer, layers, map);
	}

	function _generateEsriLayer (layer, layers, map) {
	  console.log('generateEsriLayer: ', layer.title, layer);
	  var lyr;
	  var labels = [];
	  var labelsLayer;

	  if (layer.featureCollection !== undefined) {
	    // Supporting only point geometry
	    console.log('create FeatureCollection');

	    if (layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo && layer.featureCollection.layers[0].featureSet) {
	      layer.featureCollection.layers[0].featureSet.features.map(function (feature) {
	        var mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(feature.geometry.x, feature.geometry.y));
	        var labelingInfo = layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo;

	        var label = labelMarker(mercatorToLatlng, {
	          zIndexOffset: 1,
	          properties: feature.attributes,
	          labelingInfo: labelingInfo,
	          offset: [20, 20]
	        });

	        labels.push(label);
	      });
	    }

	    lyr = featureCollection([], {
	      data: layer.itemId || layer.featureCollection,
	      opacity: layer.opacity,
	      renderer: layer.featureCollection.layers[0].layerDefinition.drawingInfo.renderer,
	      onEachFeature: function (geojson, l) {
	        if (layer.featureCollection.layers[0].popupInfo !== undefined) {
	          var popupContent = createPopupContent(layer.featureCollection.layers[0].popupInfo, geojson.properties);
	          l.bindPopup(popupContent);
	        }
	      }
	    });

	    if (labels.length > 0) {
	      labelsLayer = L.featureGroup(labels);
	      lyr = L.layerGroup([lyr, labelsLayer]);
	    }

	    layers.push({ type: 'FC', title: layer.title || '', layer: lyr });

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
	          gradient: gradient
	        });

	        layers.push({ type: 'HL', title: layer.title || '', layer: lyr });

	        return lyr;
	      } else {
	        console.log('create ArcGISFeatureLayer (with layerDefinition.drawingInfo)');

	        if (layer.layerDefinition.definitionExpression !== undefined) {
	          where = layer.layerDefinition.definitionExpression;
	        }

	        labelsLayer = L.featureGroup(labels);
	        lyr = L.esri.featureLayer({
	          url: layer.url,
	          where: where,
	          drawingInfo: layer.layerDefinition.drawingInfo,
	          onEachFeature: function (geojson, l) {
	            if (layer.popupInfo !== undefined) {
	              var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	              l.bindPopup(popupContent);
	            }
	            if (layer.layerDefinition.drawingInfo.labelingInfo !== undefined) {
	              var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;

	              var labelPos;
	              var centralKey;
	              var c, c2;
	              var offset = [0, 0];

	              if (l.feature.geometry.type === 'Point') {
	                labelPos = l.feature.geometry.coordinates.reverse();
	                offset = [20, 20];
	              } else if (l.feature.geometry.type === 'LineString') {
	                c = l.feature.geometry.coordinates;
	                centralKey = Math.round(c.length / 2);
	                labelPos = c[centralKey].reverse();
	              } else if (l.feature.geometry.type === 'MultiLineString') {
	                c = l.feature.geometry.coordinates;
	                centralKey = Math.round(c.length / 2);
	                c2 = c[centralKey];
	                centralKey = Math.round(c2.length / 2);

	                labelPos = c2[centralKey].reverse();
	              } else {
	                labelPos = l.getBounds().getCenter();
	              }

	              var label = labelMarker(labelPos, {
	                zIndexOffset: 1,
	                properties: geojson.properties,
	                labelingInfo: labelingInfo,
	                offset: offset
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
	      onEachFeature: function (geojson, l) {
	        if (layer.popupInfo !== undefined) {
	          var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	          l.bindPopup(popupContent);
	        }
	      },
	      pointToLayer: function (geojson, latlng) {
	        var f = L.marker(latlng, {
	          // icon: icon,
	          opacity: layer.opacity
	        });

	        return f;
	      }
	    });

	    layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISImageServiceLayer') {
	    console.log('create ArcGISImageServiceLayer');
	    lyr = L.esri.imageMapLayer({
	      url: layer.url
	    });

	    layers.push({ type: 'IML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISMapServiceLayer') {
	    lyr = L.esri.dynamicMapLayer({
	      url: layer.url
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
	    token: null
	  },

	  initialize: function (webmapId, options) {
	    L.setOptions(this, options);

	    this._map = this.options.map;
	    this._token = this.options.token;
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
	    var map = this._map;
	    var webmap = this;
	    var webmapMetaDataRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id;

	    L.esri.request(webmapMetaDataRequestUrl, {}, function (error, response) {
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
	    var webmapRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id + '/data';

	    L.esri.request(webmapRequestUrl, {}, function (error, response) {
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
	        response.operationalLayers.map(function (layer) {
	          var lyr = operationalLayer(layer, layers, map);
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
	exports.createPopupContent = createPopupContent;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1N5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL25vZGVfbW9kdWxlcy9sZWFmbGV0LXNoYXBlLW1hcmtlcnMvc3JjL1NoYXBlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvQ3Jvc3NNYXJrZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9ub2RlX21vZHVsZXMvbGVhZmxldC1zaGFwZS1tYXJrZXJzL3NyYy9YTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvU3F1YXJlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvRGlhbW9uZE1hcmtlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvaW50U3ltYm9sLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1N5bWJvbHMvTGluZVN5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvbHlnb25TeW1ib2wuanMiLCIuLi9ub2RlX21vZHVsZXMvZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9SZW5kZXJlcnMvQ2xhc3NCcmVha3NSZW5kZXJlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9SZW5kZXJlcnMvVW5pcXVlVmFsdWVSZW5kZXJlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9GZWF0dXJlTGF5ZXJIb29rLmpzIiwiLi4vc3JjL0ZlYXR1cmVDb2xsZWN0aW9uL0ZlYXR1cmVDb2xsZWN0aW9uLmpzIiwiLi4vc3JjL0xhYmVsL0xhYmVsTWFya2VyLmpzIiwiLi4vc3JjL1BvcHVwL1BvcHVwLmpzIiwiLi4vc3JjL09wZXJhdGlvbmFsTGF5ZXIuanMiLCIuLi9zcmMvV2ViTWFwTG9hZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuXG5leHBvcnQgdmFyIFN5bWJvbCA9IEwuQ2xhc3MuZXh0ZW5kKHtcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgICB0aGlzLl9zeW1ib2xKc29uID0gc3ltYm9sSnNvbjtcbiAgICB0aGlzLnZhbCA9IG51bGw7XG4gICAgdGhpcy5fc3R5bGVzID0ge307XG4gICAgdGhpcy5faXNEZWZhdWx0ID0gZmFsc2U7XG4gICAgdGhpcy5fbGF5ZXJUcmFuc3BhcmVuY3kgPSAxO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMubGF5ZXJUcmFuc3BhcmVuY3kpIHtcbiAgICAgIHRoaXMuX2xheWVyVHJhbnNwYXJlbmN5ID0gMSAtIChvcHRpb25zLmxheWVyVHJhbnNwYXJlbmN5IC8gMTAwLjApO1xuICAgIH1cbiAgfSxcblxuICAvLyB0aGUgZ2VvanNvbiB2YWx1ZXMgcmV0dXJuZWQgYXJlIGluIHBvaW50c1xuICBwaXhlbFZhbHVlOiBmdW5jdGlvbiAocG9pbnRWYWx1ZSkge1xuICAgIHJldHVybiBwb2ludFZhbHVlICogMS4zMzM7XG4gIH0sXG5cbiAgLy8gY29sb3IgaXMgYW4gYXJyYXkgW3IsZyxiLGFdXG4gIGNvbG9yVmFsdWU6IGZ1bmN0aW9uIChjb2xvcikge1xuICAgIHJldHVybiAncmdiKCcgKyBjb2xvclswXSArICcsJyArIGNvbG9yWzFdICsgJywnICsgY29sb3JbMl0gKyAnKSc7XG4gIH0sXG5cbiAgYWxwaGFWYWx1ZTogZnVuY3Rpb24gKGNvbG9yKSB7XG4gICAgdmFyIGFscGhhID0gY29sb3JbM10gLyAyNTUuMDtcbiAgICByZXR1cm4gYWxwaGEgKiB0aGlzLl9sYXllclRyYW5zcGFyZW5jeTtcbiAgfSxcblxuICBnZXRTaXplOiBmdW5jdGlvbiAoZmVhdHVyZSwgc2l6ZUluZm8pIHtcbiAgICB2YXIgYXR0ciA9IGZlYXR1cmUucHJvcGVydGllcztcbiAgICB2YXIgZmllbGQgPSBzaXplSW5mby5maWVsZDtcbiAgICB2YXIgc2l6ZSA9IDA7XG4gICAgdmFyIGZlYXR1cmVWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoZmllbGQpIHtcbiAgICAgIGZlYXR1cmVWYWx1ZSA9IGF0dHJbZmllbGRdO1xuICAgICAgdmFyIG1pblNpemUgPSBzaXplSW5mby5taW5TaXplO1xuICAgICAgdmFyIG1heFNpemUgPSBzaXplSW5mby5tYXhTaXplO1xuICAgICAgdmFyIG1pbkRhdGFWYWx1ZSA9IHNpemVJbmZvLm1pbkRhdGFWYWx1ZTtcbiAgICAgIHZhciBtYXhEYXRhVmFsdWUgPSBzaXplSW5mby5tYXhEYXRhVmFsdWU7XG4gICAgICB2YXIgZmVhdHVyZVJhdGlvO1xuICAgICAgdmFyIG5vcm1GaWVsZCA9IHNpemVJbmZvLm5vcm1hbGl6YXRpb25GaWVsZDtcbiAgICAgIHZhciBub3JtVmFsdWUgPSBhdHRyID8gcGFyc2VGbG9hdChhdHRyW25vcm1GaWVsZF0pIDogdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoZmVhdHVyZVZhbHVlID09PSBudWxsIHx8IChub3JtRmllbGQgJiYgKChpc05hTihub3JtVmFsdWUpIHx8IG5vcm1WYWx1ZSA9PT0gMCkpKSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKCFpc05hTihub3JtVmFsdWUpKSB7XG4gICAgICAgIGZlYXR1cmVWYWx1ZSAvPSBub3JtVmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChtaW5TaXplICE9PSBudWxsICYmIG1heFNpemUgIT09IG51bGwgJiYgbWluRGF0YVZhbHVlICE9PSBudWxsICYmIG1heERhdGFWYWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoZmVhdHVyZVZhbHVlIDw9IG1pbkRhdGFWYWx1ZSkge1xuICAgICAgICAgIHNpemUgPSBtaW5TaXplO1xuICAgICAgICB9IGVsc2UgaWYgKGZlYXR1cmVWYWx1ZSA+PSBtYXhEYXRhVmFsdWUpIHtcbiAgICAgICAgICBzaXplID0gbWF4U2l6ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmZWF0dXJlUmF0aW8gPSAoZmVhdHVyZVZhbHVlIC0gbWluRGF0YVZhbHVlKSAvIChtYXhEYXRhVmFsdWUgLSBtaW5EYXRhVmFsdWUpO1xuICAgICAgICAgIHNpemUgPSBtaW5TaXplICsgKGZlYXR1cmVSYXRpbyAqIChtYXhTaXplIC0gbWluU2l6ZSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzaXplID0gaXNOYU4oc2l6ZSkgPyAwIDogc2l6ZTtcbiAgICB9XG4gICAgcmV0dXJuIHNpemU7XG4gIH0sXG5cbiAgZ2V0Q29sb3I6IGZ1bmN0aW9uIChmZWF0dXJlLCBjb2xvckluZm8pIHtcbiAgICAvLyByZXF1aXJlZCBpbmZvcm1hdGlvbiB0byBnZXQgY29sb3JcbiAgICBpZiAoIShmZWF0dXJlLnByb3BlcnRpZXMgJiYgY29sb3JJbmZvICYmIGNvbG9ySW5mby5maWVsZCAmJiBjb2xvckluZm8uc3RvcHMpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgYXR0ciA9IGZlYXR1cmUucHJvcGVydGllcztcbiAgICB2YXIgZmVhdHVyZVZhbHVlID0gYXR0cltjb2xvckluZm8uZmllbGRdO1xuICAgIHZhciBsb3dlckJvdW5kQ29sb3IsIHVwcGVyQm91bmRDb2xvciwgbG93ZXJCb3VuZCwgdXBwZXJCb3VuZDtcbiAgICB2YXIgbm9ybUZpZWxkID0gY29sb3JJbmZvLm5vcm1hbGl6YXRpb25GaWVsZDtcbiAgICB2YXIgbm9ybVZhbHVlID0gYXR0ciA/IHBhcnNlRmxvYXQoYXR0cltub3JtRmllbGRdKSA6IHVuZGVmaW5lZDtcbiAgICBpZiAoZmVhdHVyZVZhbHVlID09PSBudWxsIHx8IChub3JtRmllbGQgJiYgKChpc05hTihub3JtVmFsdWUpIHx8IG5vcm1WYWx1ZSA9PT0gMCkpKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCFpc05hTihub3JtVmFsdWUpKSB7XG4gICAgICBmZWF0dXJlVmFsdWUgLz0gbm9ybVZhbHVlO1xuICAgIH1cblxuICAgIGlmIChmZWF0dXJlVmFsdWUgPD0gY29sb3JJbmZvLnN0b3BzWzBdLnZhbHVlKSB7XG4gICAgICByZXR1cm4gY29sb3JJbmZvLnN0b3BzWzBdLmNvbG9yO1xuICAgIH1cbiAgICB2YXIgbGFzdFN0b3AgPSBjb2xvckluZm8uc3RvcHNbY29sb3JJbmZvLnN0b3BzLmxlbmd0aCAtIDFdO1xuICAgIGlmIChmZWF0dXJlVmFsdWUgPj0gbGFzdFN0b3AudmFsdWUpIHtcbiAgICAgIHJldHVybiBsYXN0U3RvcC5jb2xvcjtcbiAgICB9XG5cbiAgICAvLyBnbyB0aHJvdWdoIHRoZSBzdG9wcyB0byBmaW5kIG1pbiBhbmQgbWF4XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2xvckluZm8uc3RvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzdG9wSW5mbyA9IGNvbG9ySW5mby5zdG9wc1tpXTtcblxuICAgICAgaWYgKHN0b3BJbmZvLnZhbHVlIDw9IGZlYXR1cmVWYWx1ZSkge1xuICAgICAgICBsb3dlckJvdW5kQ29sb3IgPSBzdG9wSW5mby5jb2xvcjtcbiAgICAgICAgbG93ZXJCb3VuZCA9IHN0b3BJbmZvLnZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChzdG9wSW5mby52YWx1ZSA+IGZlYXR1cmVWYWx1ZSkge1xuICAgICAgICB1cHBlckJvdW5kQ29sb3IgPSBzdG9wSW5mby5jb2xvcjtcbiAgICAgICAgdXBwZXJCb3VuZCA9IHN0b3BJbmZvLnZhbHVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmZWF0dXJlIGZhbGxzIGJldHdlZW4gdHdvIHN0b3BzLCBpbnRlcnBsYXRlIHRoZSBjb2xvcnNcbiAgICBpZiAoIWlzTmFOKGxvd2VyQm91bmQpICYmICFpc05hTih1cHBlckJvdW5kKSkge1xuICAgICAgdmFyIHJhbmdlID0gdXBwZXJCb3VuZCAtIGxvd2VyQm91bmQ7XG4gICAgICBpZiAocmFuZ2UgPiAwKSB7XG4gICAgICAgIC8vIG1vcmUgd2VpZ2h0IHRoZSBmdXJ0aGVyIGl0IGlzIGZyb20gdGhlIGxvd2VyIGJvdW5kXG4gICAgICAgIHZhciB1cHBlckJvdW5kQ29sb3JXZWlnaHQgPSAoZmVhdHVyZVZhbHVlIC0gbG93ZXJCb3VuZCkgLyByYW5nZTtcbiAgICAgICAgaWYgKHVwcGVyQm91bmRDb2xvcldlaWdodCkge1xuICAgICAgICAgIC8vIG1vcmUgd2VpZ2h0IHRoZSBmdXJ0aGVyIGl0IGlzIGZyb20gdGhlIHVwcGVyIGJvdW5kXG4gICAgICAgICAgdmFyIGxvd2VyQm91bmRDb2xvcldlaWdodCA9ICh1cHBlckJvdW5kIC0gZmVhdHVyZVZhbHVlKSAvIHJhbmdlO1xuICAgICAgICAgIGlmIChsb3dlckJvdW5kQ29sb3JXZWlnaHQpIHtcbiAgICAgICAgICAgIC8vIGludGVycG9sYXRlIHRoZSBsb3dlciBhbmQgdXBwZXIgYm91bmQgY29sb3IgYnkgYXBwbHlpbmcgdGhlXG4gICAgICAgICAgICAvLyB3ZWlnaHRzIHRvIGVhY2ggb2YgdGhlIHJnYmEgY29sb3JzIGFuZCBhZGRpbmcgdGhlbSB0b2dldGhlclxuICAgICAgICAgICAgdmFyIGludGVycG9sYXRlZENvbG9yID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IDQ7IGorKykge1xuICAgICAgICAgICAgICBpbnRlcnBvbGF0ZWRDb2xvcltqXSA9IE1hdGgucm91bmQobG93ZXJCb3VuZENvbG9yW2pdICogbG93ZXJCb3VuZENvbG9yV2VpZ2h0ICsgdXBwZXJCb3VuZENvbG9yW2pdICogdXBwZXJCb3VuZENvbG9yV2VpZ2h0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnRlcnBvbGF0ZWRDb2xvcjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gZGlmZmVyZW5jZSBiZXR3ZWVuIGZlYXR1cmVWYWx1ZSBhbmQgdXBwZXJCb3VuZCwgMTAwJSBvZiB1cHBlckJvdW5kQ29sb3JcbiAgICAgICAgICAgIHJldHVybiB1cHBlckJvdW5kQ29sb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vIGRpZmZlcmVuY2UgYmV0d2VlbiBmZWF0dXJlVmFsdWUgYW5kIGxvd2VyQm91bmQsIDEwMCUgb2YgbG93ZXJCb3VuZENvbG9yXG4gICAgICAgICAgcmV0dXJuIGxvd2VyQm91bmRDb2xvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiB3ZSBnZXQgdG8gaGVyZSwgbm9uZSBvZiB0aGUgY2FzZXMgYXBwbHkgc28gcmV0dXJuIG51bGxcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8vIGV4cG9ydCBmdW5jdGlvbiBzeW1ib2wgKHN5bWJvbEpzb24pIHtcbi8vICAgcmV0dXJuIG5ldyBTeW1ib2woc3ltYm9sSnNvbik7XG4vLyB9XG5cbmV4cG9ydCBkZWZhdWx0IFN5bWJvbDtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuXG5leHBvcnQgdmFyIFNoYXBlTWFya2VyID0gTC5QYXRoLmV4dGVuZCh7XG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcbiAgICB0aGlzLl9zaXplID0gc2l6ZTtcbiAgICB0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xuICAgIHRoaXMuX3N2Z0NhbnZhc0luY2x1ZGVzKCk7XG4gIH0sXG5cbiAgdG9HZW9KU09OOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIEwuR2VvSlNPTi5nZXRGZWF0dXJlKHRoaXMsIHtcbiAgICAgIHR5cGU6ICdQb2ludCcsXG4gICAgICBjb29yZGluYXRlczogTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuZ2V0TGF0TG5nKCkpXG4gICAgfSk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gaW1wbGVtZW50IGluIHN1YiBjbGFzc1xuICB9LFxuXG4gIF9wcm9qZWN0OiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcG9pbnQgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KHRoaXMuX2xhdGxuZyk7XG4gIH0sXG5cbiAgX3VwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9tYXApIHtcbiAgICAgIHRoaXMuX3VwZGF0ZVBhdGgoKTtcbiAgICB9XG4gIH0sXG5cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBpbXBsZW1lbnQgaW4gc3ViIGNsYXNzXG4gIH0sXG5cbiAgc2V0TGF0TG5nOiBmdW5jdGlvbiAobGF0bG5nKSB7XG4gICAgdGhpcy5fbGF0bG5nID0gTC5sYXRMbmcobGF0bG5nKTtcbiAgICB0aGlzLnJlZHJhdygpO1xuICAgIHJldHVybiB0aGlzLmZpcmUoJ21vdmUnLCB7bGF0bG5nOiB0aGlzLl9sYXRsbmd9KTtcbiAgfSxcblxuICBnZXRMYXRMbmc6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGF0bG5nO1xuICB9LFxuXG4gIHNldFNpemU6IGZ1bmN0aW9uIChzaXplKSB7XG4gICAgdGhpcy5fc2l6ZSA9IHNpemU7XG4gICAgcmV0dXJuIHRoaXMucmVkcmF3KCk7XG4gIH0sXG5cbiAgZ2V0U2l6ZTogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9zaXplO1xuICB9XG59KTtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgU2hhcGVNYXJrZXIgfSBmcm9tICcuL1NoYXBlTWFya2VyJztcblxuZXhwb3J0IHZhciBDcm9zc01hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVDcm9zc01hcmtlcih0aGlzKTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBMLkNhbnZhcy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVDcm9zc01hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLngsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLnggLSBvZmZzZXQsIGxhdGxuZy55KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkpO1xuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgTC5TVkcuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlQ3Jvc3NNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG5cbiAgICAgICAgaWYgKEwuQnJvd3Nlci52bWwpIHtcbiAgICAgICAgICBsYXRsbmcuX3JvdW5kKCk7XG4gICAgICAgICAgb2Zmc2V0ID0gTWF0aC5yb3VuZChvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0ciA9ICdNJyArIGxhdGxuZy54ICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgbGF0bG5nLnggKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpICtcbiAgICAgICAgICAnTScgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgbGF0bG5nLnkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyBsYXRsbmcueTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciBjcm9zc01hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBDcm9zc01hcmtlcihsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgY3Jvc3NNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IFNoYXBlTWFya2VyIH0gZnJvbSAnLi9TaGFwZU1hcmtlcic7XG5cbmV4cG9ydCB2YXIgWE1hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVYTWFya2VyKHRoaXMpO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIEwuQ2FudmFzLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZVhNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG4gICAgICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgTC5TVkcuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlWE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpICtcbiAgICAgICAgICAnTScgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCk7XG5cbiAgICAgICAgdGhpcy5fc2V0UGF0aChsYXllciwgc3RyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG5cbmV4cG9ydCB2YXIgeE1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBYTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCB4TWFya2VyO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgeyBTaGFwZU1hcmtlciB9IGZyb20gJy4vU2hhcGVNYXJrZXInO1xuXG5leHBvcnQgdmFyIFNxdWFyZU1hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBmaWxsOiB0cnVlXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVTcXVhcmVNYXJrZXIodGhpcyk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgTC5DYW52YXMuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlU3F1YXJlTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuICAgICAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcblxuICAgICAgICBjdHgubW92ZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSArIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggLSBvZmZzZXQsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSAtIG9mZnNldCk7XG5cbiAgICAgICAgY3R4LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBMLlNWRy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVTcXVhcmVNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG5cbiAgICAgICAgaWYgKEwuQnJvd3Nlci52bWwpIHtcbiAgICAgICAgICBsYXRsbmcuX3JvdW5kKCk7XG4gICAgICAgICAgb2Zmc2V0ID0gTWF0aC5yb3VuZChvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0ciA9ICdNJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpO1xuXG4gICAgICAgIHN0ciA9IHN0ciArIChMLkJyb3dzZXIuc3ZnID8gJ3onIDogJ3gnKTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciBzcXVhcmVNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgU3F1YXJlTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBzcXVhcmVNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IFNoYXBlTWFya2VyIH0gZnJvbSAnLi9TaGFwZU1hcmtlcic7XG5cbmV4cG9ydCB2YXIgRGlhbW9uZE1hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBmaWxsOiB0cnVlXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVEaWFtb25kTWFya2VyKHRoaXMpO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIEwuQ2FudmFzLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZURpYW1vbmRNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG4gICAgICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLngsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55KTtcblxuICAgICAgICBjdHguY2xvc2VQYXRoKCk7XG5cbiAgICAgICAgdGhpcy5fZmlsbFN0cm9rZShjdHgsIGxheWVyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIEwuU1ZHLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZURpYW1vbmRNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG5cbiAgICAgICAgaWYgKEwuQnJvd3Nlci52bWwpIHtcbiAgICAgICAgICBsYXRsbmcuX3JvdW5kKCk7XG4gICAgICAgICAgb2Zmc2V0ID0gTWF0aC5yb3VuZChvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0ciA9ICdNJyArIGxhdGxuZy54ICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIGxhdGxuZy55ICtcbiAgICAgICAgICAnTCcgKyBsYXRsbmcueCArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyBsYXRsbmcueTtcblxuICAgICAgICBzdHIgPSBzdHIgKyAoTC5Ccm93c2VyLnN2ZyA/ICd6JyA6ICd4Jyk7XG5cbiAgICAgICAgdGhpcy5fc2V0UGF0aChsYXllciwgc3RyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG5cbmV4cG9ydCB2YXIgZGlhbW9uZE1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBEaWFtb25kTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBkaWFtb25kTWFya2VyO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgU3ltYm9sIGZyb20gJy4vU3ltYm9sJztcbmltcG9ydCB7c3F1YXJlTWFya2VyLCB4TWFya2VyLCBjcm9zc01hcmtlciwgZGlhbW9uZE1hcmtlcn0gZnJvbSAnbGVhZmxldC1zaGFwZS1tYXJrZXJzJztcblxuZXhwb3J0IHZhciBQb2ludFN5bWJvbCA9IFN5bWJvbC5leHRlbmQoe1xuXG4gIHN0YXRpY3M6IHtcbiAgICBNQVJLRVJUWVBFUzogWydlc3JpU01TQ2lyY2xlJywgJ2VzcmlTTVNDcm9zcycsICdlc3JpU01TRGlhbW9uZCcsICdlc3JpU01TU3F1YXJlJywgJ2VzcmlTTVNYJywgJ2VzcmlQTVMnXVxuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gICAgU3ltYm9sLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG4gICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgIHRoaXMuc2VydmljZVVybCA9IG9wdGlvbnMudXJsO1xuICAgIH1cbiAgICBpZiAoc3ltYm9sSnNvbikge1xuICAgICAgaWYgKHN5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlQTVMnKSB7XG4gICAgICAgIHZhciB1cmwgPSB0aGlzLnNlcnZpY2VVcmwgKyAnaW1hZ2VzLycgKyB0aGlzLl9zeW1ib2xKc29uLnVybDtcbiAgICAgICAgdGhpcy5faWNvblVybCA9IG9wdGlvbnMgJiYgb3B0aW9ucy50b2tlbiA/IHVybCArICc/dG9rZW49JyArIG9wdGlvbnMudG9rZW4gOiB1cmw7XG4gICAgICAgIGlmIChzeW1ib2xKc29uLmltYWdlRGF0YSkge1xuICAgICAgICAgIHRoaXMuX2ljb25VcmwgPSAnZGF0YTonICsgc3ltYm9sSnNvbi5jb250ZW50VHlwZSArICc7YmFzZTY0LCcgKyBzeW1ib2xKc29uLmltYWdlRGF0YTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZWFmbGV0IGRvZXMgbm90IGFsbG93IHJlc2l6aW5nIGljb25zIHNvIGtlZXAgYSBoYXNoIG9mIGRpZmZlcmVudFxuICAgICAgICAvLyBpY29uIHNpemVzIHRvIHRyeSBhbmQga2VlcCBkb3duIG9uIHRoZSBudW1iZXIgb2YgaWNvbnMgY3JlYXRlZFxuICAgICAgICB0aGlzLl9pY29ucyA9IHt9O1xuICAgICAgICAvLyBjcmVhdGUgYmFzZSBpY29uXG4gICAgICAgIHRoaXMuaWNvbiA9IHRoaXMuX2NyZWF0ZUljb24odGhpcy5fc3ltYm9sSnNvbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maWxsU3R5bGVzKCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIF9maWxsU3R5bGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24ub3V0bGluZSAmJiB0aGlzLl9zeW1ib2xKc29uLnNpemUgPiAwKSB7XG4gICAgICB0aGlzLl9zdHlsZXMuc3Ryb2tlID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlcy53ZWlnaHQgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lLndpZHRoKTtcbiAgICAgIHRoaXMuX3N0eWxlcy5jb2xvciA9IHRoaXMuY29sb3JWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUuY29sb3IpO1xuICAgICAgdGhpcy5fc3R5bGVzLm9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lLmNvbG9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3R5bGVzLnN0cm9rZSA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5jb2xvcikge1xuICAgICAgdGhpcy5fc3R5bGVzLmZpbGxDb2xvciA9IHRoaXMuY29sb3JWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gMDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSA9PT0gJ2VzcmlTTVNDaXJjbGUnKSB7XG4gICAgICB0aGlzLl9zdHlsZXMucmFkaXVzID0gdGhpcy5waXhlbFZhbHVlKHRoaXMuX3N5bWJvbEpzb24uc2l6ZSkgLyAyLjA7XG4gICAgfVxuICB9LFxuXG4gIF9jcmVhdGVJY29uOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciB3aWR0aCA9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLndpZHRoKTtcbiAgICB2YXIgaGVpZ2h0ID0gd2lkdGg7XG4gICAgaWYgKG9wdGlvbnMuaGVpZ2h0KSB7XG4gICAgICBoZWlnaHQgPSB0aGlzLnBpeGVsVmFsdWUob3B0aW9ucy5oZWlnaHQpO1xuICAgIH1cbiAgICB2YXIgeE9mZnNldCA9IHdpZHRoIC8gMi4wO1xuICAgIHZhciB5T2Zmc2V0ID0gaGVpZ2h0IC8gMi4wO1xuXG4gICAgaWYgKG9wdGlvbnMueG9mZnNldCkge1xuICAgICAgeE9mZnNldCArPSB0aGlzLnBpeGVsVmFsdWUob3B0aW9ucy54b2Zmc2V0KTtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMueW9mZnNldCkge1xuICAgICAgeU9mZnNldCArPSB0aGlzLnBpeGVsVmFsdWUob3B0aW9ucy55b2Zmc2V0KTtcbiAgICB9XG5cbiAgICB2YXIgaWNvbiA9IEwuaWNvbih7XG4gICAgICBpY29uVXJsOiB0aGlzLl9pY29uVXJsLFxuICAgICAgaWNvblNpemU6IFt3aWR0aCwgaGVpZ2h0XSxcbiAgICAgIGljb25BbmNob3I6IFt4T2Zmc2V0LCB5T2Zmc2V0XVxuICAgIH0pO1xuICAgIHRoaXMuX2ljb25zW29wdGlvbnMud2lkdGgudG9TdHJpbmcoKV0gPSBpY29uO1xuICAgIHJldHVybiBpY29uO1xuICB9LFxuXG4gIF9nZXRJY29uOiBmdW5jdGlvbiAoc2l6ZSkge1xuICAgIC8vIGNoZWNrIHRvIHNlZSBpZiBpdCBpcyBhbHJlYWR5IGNyZWF0ZWQgYnkgc2l6ZVxuICAgIHZhciBpY29uID0gdGhpcy5faWNvbnNbc2l6ZS50b1N0cmluZygpXTtcbiAgICBpZiAoIWljb24pIHtcbiAgICAgIGljb24gPSB0aGlzLl9jcmVhdGVJY29uKHt3aWR0aDogc2l6ZX0pO1xuICAgIH1cbiAgICByZXR1cm4gaWNvbjtcbiAgfSxcblxuICBwb2ludFRvTGF5ZXI6IGZ1bmN0aW9uIChnZW9qc29uLCBsYXRsbmcsIHZpc3VhbFZhcmlhYmxlcywgb3B0aW9ucykge1xuICAgIHZhciBzaXplID0gdGhpcy5fc3ltYm9sSnNvbi5zaXplIHx8IHRoaXMuX3N5bWJvbEpzb24ud2lkdGg7XG4gICAgaWYgKCF0aGlzLl9pc0RlZmF1bHQpIHtcbiAgICAgIGlmICh2aXN1YWxWYXJpYWJsZXMuc2l6ZUluZm8pIHtcbiAgICAgICAgdmFyIGNhbGN1bGF0ZWRTaXplID0gdGhpcy5nZXRTaXplKGdlb2pzb24sIHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbyk7XG4gICAgICAgIGlmIChjYWxjdWxhdGVkU2l6ZSkge1xuICAgICAgICAgIHNpemUgPSBjYWxjdWxhdGVkU2l6ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pIHtcbiAgICAgICAgdmFyIGNvbG9yID0gdGhpcy5nZXRDb2xvcihnZW9qc29uLCB2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKTtcbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxDb2xvciA9IHRoaXMuY29sb3JWYWx1ZShjb2xvcik7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKGNvbG9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpUE1TJykge1xuICAgICAgdmFyIGxheWVyT3B0aW9ucyA9IEwuZXh0ZW5kKHt9LCB7aWNvbjogdGhpcy5fZ2V0SWNvbihzaXplKX0sIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuIEwubWFya2VyKGxhdGxuZywgbGF5ZXJPcHRpb25zKTtcbiAgICB9XG4gICAgc2l6ZSA9IHRoaXMucGl4ZWxWYWx1ZShzaXplKTtcblxuICAgIHN3aXRjaCAodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSkge1xuICAgICAgY2FzZSAnZXNyaVNNU1NxdWFyZSc6XG4gICAgICAgIHJldHVybiBzcXVhcmVNYXJrZXIobGF0bG5nLCBzaXplLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gICAgICBjYXNlICdlc3JpU01TRGlhbW9uZCc6XG4gICAgICAgIHJldHVybiBkaWFtb25kTWFya2VyKGxhdGxuZywgc2l6ZSwgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICAgICAgY2FzZSAnZXNyaVNNU0Nyb3NzJzpcbiAgICAgICAgcmV0dXJuIGNyb3NzTWFya2VyKGxhdGxuZywgc2l6ZSwgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICAgICAgY2FzZSAnZXNyaVNNU1gnOlxuICAgICAgICByZXR1cm4geE1hcmtlcihsYXRsbmcsIHNpemUsIEwuZXh0ZW5kKHt9LCB0aGlzLl9zdHlsZXMsIG9wdGlvbnMpKTtcbiAgICB9XG4gICAgdGhpcy5fc3R5bGVzLnJhZGl1cyA9IHNpemUgLyAyLjA7XG4gICAgcmV0dXJuIEwuY2lyY2xlTWFya2VyKGxhdGxuZywgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBvaW50U3ltYm9sIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgUG9pbnRTeW1ib2woc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBvaW50U3ltYm9sO1xuIiwiaW1wb3J0IFN5bWJvbCBmcm9tICcuL1N5bWJvbCc7XG5cbmV4cG9ydCB2YXIgTGluZVN5bWJvbCA9IFN5bWJvbC5leHRlbmQoe1xuICBzdGF0aWNzOiB7XG4gICAgLy8gTm90IGltcGxlbWVudGVkICdlc3JpU0xTTnVsbCdcbiAgICBMSU5FVFlQRVM6IFsnZXNyaVNMU0Rhc2gnLCAnZXNyaVNMU0RvdCcsICdlc3JpU0xTRGFzaERvdERvdCcsICdlc3JpU0xTRGFzaERvdCcsICdlc3JpU0xTU29saWQnXVxuICB9LFxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICAgIFN5bWJvbC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHN5bWJvbEpzb24sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2ZpbGxTdHlsZXMoKTtcbiAgfSxcblxuICBfZmlsbFN0eWxlczogZnVuY3Rpb24gKCkge1xuICAgIC8vIHNldCB0aGUgZGVmYXVsdHMgdGhhdCBzaG93IHVwIG9uIGFyY2dpcyBvbmxpbmVcbiAgICB0aGlzLl9zdHlsZXMubGluZUNhcCA9ICdidXR0JztcbiAgICB0aGlzLl9zdHlsZXMubGluZUpvaW4gPSAnbWl0ZXInO1xuICAgIHRoaXMuX3N0eWxlcy5maWxsID0gZmFsc2U7XG4gICAgdGhpcy5fc3R5bGVzLndlaWdodCA9IDA7XG5cbiAgICBpZiAoIXRoaXMuX3N5bWJvbEpzb24pIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdHlsZXM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5jb2xvciA9IHRoaXMuY29sb3JWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICAgIHRoaXMuX3N0eWxlcy5vcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgIH1cblxuICAgIGlmICghaXNOYU4odGhpcy5fc3ltYm9sSnNvbi53aWR0aCkpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy53ZWlnaHQgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5fc3ltYm9sSnNvbi53aWR0aCk7XG5cbiAgICAgIHZhciBkYXNoVmFsdWVzID0gW107XG5cbiAgICAgIHN3aXRjaCAodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSkge1xuICAgICAgICBjYXNlICdlc3JpU0xTRGFzaCc6XG4gICAgICAgICAgZGFzaFZhbHVlcyA9IFs0LCAzXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZXNyaVNMU0RvdCc6XG4gICAgICAgICAgZGFzaFZhbHVlcyA9IFsxLCAzXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZXNyaVNMU0Rhc2hEb3QnOlxuICAgICAgICAgIGRhc2hWYWx1ZXMgPSBbOCwgMywgMSwgM107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2VzcmlTTFNEYXNoRG90RG90JzpcbiAgICAgICAgICBkYXNoVmFsdWVzID0gWzgsIDMsIDEsIDMsIDEsIDNdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyB1c2UgdGhlIGRhc2ggdmFsdWVzIGFuZCB0aGUgbGluZSB3ZWlnaHQgdG8gc2V0IGRhc2ggYXJyYXlcbiAgICAgIGlmIChkYXNoVmFsdWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXNoVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZGFzaFZhbHVlc1tpXSAqPSB0aGlzLl9zdHlsZXMud2VpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3R5bGVzLmRhc2hBcnJheSA9IGRhc2hWYWx1ZXMuam9pbignLCcpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzdHlsZTogZnVuY3Rpb24gKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcykge1xuICAgIGlmICghdGhpcy5faXNEZWZhdWx0ICYmIHZpc3VhbFZhcmlhYmxlcykge1xuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbykge1xuICAgICAgICB2YXIgY2FsY3VsYXRlZFNpemUgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5nZXRTaXplKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbykpO1xuICAgICAgICBpZiAoY2FsY3VsYXRlZFNpemUpIHtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMud2VpZ2h0ID0gY2FsY3VsYXRlZFNpemU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKSB7XG4gICAgICAgIHZhciBjb2xvciA9IHRoaXMuZ2V0Q29sb3IoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbyk7XG4gICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgIHRoaXMuX3N0eWxlcy5jb2xvciA9IHRoaXMuY29sb3JWYWx1ZShjb2xvcik7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLm9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUoY29sb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHlsZXM7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gbGluZVN5bWJvbCAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IExpbmVTeW1ib2woc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGxpbmVTeW1ib2w7XG4iLCJpbXBvcnQgU3ltYm9sIGZyb20gJy4vU3ltYm9sJztcbmltcG9ydCBsaW5lU3ltYm9sIGZyb20gJy4vTGluZVN5bWJvbCc7XG5cbmV4cG9ydCB2YXIgUG9seWdvblN5bWJvbCA9IFN5bWJvbC5leHRlbmQoe1xuICBzdGF0aWNzOiB7XG4gICAgLy8gbm90IGltcGxlbWVudGVkOiAnZXNyaVNGU0JhY2t3YXJkRGlhZ29uYWwnLCdlc3JpU0ZTQ3Jvc3MnLCdlc3JpU0ZTRGlhZ29uYWxDcm9zcycsJ2VzcmlTRlNGb3J3YXJkRGlhZ29uYWwnLCdlc3JpU0ZTSG9yaXpvbnRhbCcsJ2VzcmlTRlNOdWxsJywnZXNyaVNGU1ZlcnRpY2FsJ1xuICAgIFBPTFlHT05UWVBFUzogWydlc3JpU0ZTU29saWQnXVxuICB9LFxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICAgIFN5bWJvbC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHN5bWJvbEpzb24sIG9wdGlvbnMpO1xuICAgIGlmIChzeW1ib2xKc29uKSB7XG4gICAgICB0aGlzLl9saW5lU3R5bGVzID0gbGluZVN5bWJvbChzeW1ib2xKc29uLm91dGxpbmUsIG9wdGlvbnMpLnN0eWxlKCk7XG4gICAgICB0aGlzLl9maWxsU3R5bGVzKCk7XG4gICAgfVxuICB9LFxuXG4gIF9maWxsU3R5bGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2xpbmVTdHlsZXMpIHtcbiAgICAgIGlmICh0aGlzLl9saW5lU3R5bGVzLndlaWdodCA9PT0gMCkge1xuICAgICAgICAvLyB3aGVuIHdlaWdodCBpcyAwLCBzZXR0aW5nIHRoZSBzdHJva2UgdG8gZmFsc2UgY2FuIHN0aWxsIGxvb2sgYmFkXG4gICAgICAgIC8vIChnYXBzIGJldHdlZW4gdGhlIHBvbHlnb25zKVxuICAgICAgICB0aGlzLl9zdHlsZXMuc3Ryb2tlID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjb3B5IHRoZSBsaW5lIHN5bWJvbCBzdHlsZXMgaW50byB0aGlzIHN5bWJvbCdzIHN0eWxlc1xuICAgICAgICBmb3IgKHZhciBzdHlsZUF0dHIgaW4gdGhpcy5fbGluZVN0eWxlcykge1xuICAgICAgICAgIHRoaXMuX3N0eWxlc1tzdHlsZUF0dHJdID0gdGhpcy5fbGluZVN0eWxlc1tzdHlsZUF0dHJdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0IHRoZSBmaWxsIGZvciB0aGUgcG9seWdvblxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uKSB7XG4gICAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5jb2xvciAmJlxuICAgICAgICAgIC8vIGRvbid0IGZpbGwgcG9seWdvbiBpZiB0eXBlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgICBQb2x5Z29uU3ltYm9sLlBPTFlHT05UWVBFUy5pbmRleE9mKHRoaXMuX3N5bWJvbEpzb24uc3R5bGUgPj0gMCkpIHtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGwgPSB0cnVlO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbENvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSAwO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzdHlsZTogZnVuY3Rpb24gKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcykge1xuICAgIGlmICghdGhpcy5faXNEZWZhdWx0ICYmIHZpc3VhbFZhcmlhYmxlcyAmJiB2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKSB7XG4gICAgICB2YXIgY29sb3IgPSB0aGlzLmdldENvbG9yKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pO1xuICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsQ29sb3IgPSB0aGlzLmNvbG9yVmFsdWUoY29sb3IpO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUoY29sb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3R5bGVzO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBvbHlnb25TeW1ib2wgKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBQb2x5Z29uU3ltYm9sKHN5bWJvbEpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwb2x5Z29uU3ltYm9sO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5cbmltcG9ydCBwb2ludFN5bWJvbCBmcm9tICcuLi9TeW1ib2xzL1BvaW50U3ltYm9sJztcbmltcG9ydCBsaW5lU3ltYm9sIGZyb20gJy4uL1N5bWJvbHMvTGluZVN5bWJvbCc7XG5pbXBvcnQgcG9seWdvblN5bWJvbCBmcm9tICcuLi9TeW1ib2xzL1BvbHlnb25TeW1ib2wnO1xuXG5leHBvcnQgdmFyIFJlbmRlcmVyID0gTC5DbGFzcy5leHRlbmQoe1xuICBvcHRpb25zOiB7XG4gICAgcHJvcG9ydGlvbmFsUG9seWdvbjogZmFsc2UsXG4gICAgY2xpY2thYmxlOiB0cnVlXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICAgIHRoaXMuX3JlbmRlcmVySnNvbiA9IHJlbmRlcmVySnNvbjtcbiAgICB0aGlzLl9wb2ludFN5bWJvbHMgPSBmYWxzZTtcbiAgICB0aGlzLl9zeW1ib2xzID0gW107XG4gICAgdGhpcy5fdmlzdWFsVmFyaWFibGVzID0gdGhpcy5fcGFyc2VWaXN1YWxWYXJpYWJsZXMocmVuZGVyZXJKc29uLnZpc3VhbFZhcmlhYmxlcyk7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cbiAgX3BhcnNlVmlzdWFsVmFyaWFibGVzOiBmdW5jdGlvbiAodmlzdWFsVmFyaWFibGVzKSB7XG4gICAgdmFyIHZpc1ZhcnMgPSB7fTtcbiAgICBpZiAodmlzdWFsVmFyaWFibGVzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZpc3VhbFZhcmlhYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2aXNWYXJzW3Zpc3VhbFZhcmlhYmxlc1tpXS50eXBlXSA9IHZpc3VhbFZhcmlhYmxlc1tpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZpc1ZhcnM7XG4gIH0sXG5cbiAgX2NyZWF0ZURlZmF1bHRTeW1ib2w6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fcmVuZGVyZXJKc29uLmRlZmF1bHRTeW1ib2wpIHtcbiAgICAgIHRoaXMuX2RlZmF1bHRTeW1ib2wgPSB0aGlzLl9uZXdTeW1ib2wodGhpcy5fcmVuZGVyZXJKc29uLmRlZmF1bHRTeW1ib2wpO1xuICAgICAgdGhpcy5fZGVmYXVsdFN5bWJvbC5faXNEZWZhdWx0ID0gdHJ1ZTtcbiAgICB9XG4gIH0sXG5cbiAgX25ld1N5bWJvbDogZnVuY3Rpb24gKHN5bWJvbEpzb24pIHtcbiAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVNNUycgfHwgc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVBNUycpIHtcbiAgICAgIHRoaXMuX3BvaW50U3ltYm9scyA9IHRydWU7XG4gICAgICByZXR1cm4gcG9pbnRTeW1ib2woc3ltYm9sSnNvbiwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG4gICAgaWYgKHN5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlTTFMnKSB7XG4gICAgICByZXR1cm4gbGluZVN5bWJvbChzeW1ib2xKc29uLCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbiAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVNGUycpIHtcbiAgICAgIHJldHVybiBwb2x5Z29uU3ltYm9sKHN5bWJvbEpzb24sIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuICB9LFxuXG4gIF9nZXRTeW1ib2w6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBvdmVycmlkZVxuICB9LFxuXG4gIGF0dGFjaFN0eWxlc1RvTGF5ZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgIGlmICh0aGlzLl9wb2ludFN5bWJvbHMpIHtcbiAgICAgIGxheWVyLm9wdGlvbnMucG9pbnRUb0xheWVyID0gTC5VdGlsLmJpbmQodGhpcy5wb2ludFRvTGF5ZXIsIHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXllci5vcHRpb25zLnN0eWxlID0gTC5VdGlsLmJpbmQodGhpcy5zdHlsZSwgdGhpcyk7XG4gICAgICBsYXllci5fb3JpZ2luYWxTdHlsZSA9IGxheWVyLm9wdGlvbnMuc3R5bGU7XG4gICAgfVxuICB9LFxuXG4gIHBvaW50VG9MYXllcjogZnVuY3Rpb24gKGdlb2pzb24sIGxhdGxuZykge1xuICAgIHZhciBzeW0gPSB0aGlzLl9nZXRTeW1ib2woZ2VvanNvbik7XG4gICAgaWYgKHN5bSAmJiBzeW0ucG9pbnRUb0xheWVyKSB7XG4gICAgICAvLyByaWdodCBub3cgY3VzdG9tIHBhbmVzIGFyZSB0aGUgb25seSBvcHRpb24gcHVzaGVkIHRocm91Z2hcbiAgICAgIHJldHVybiBzeW0ucG9pbnRUb0xheWVyKGdlb2pzb24sIGxhdGxuZywgdGhpcy5fdmlzdWFsVmFyaWFibGVzLCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbiAgICAvLyBpbnZpc2libGUgc3ltYm9sb2d5XG4gICAgcmV0dXJuIEwuY2lyY2xlTWFya2VyKGxhdGxuZywge3JhZGl1czogMCwgb3BhY2l0eTogMH0pO1xuICB9LFxuXG4gIHN0eWxlOiBmdW5jdGlvbiAoZmVhdHVyZSkge1xuICAgIHZhciB1c2VyU3R5bGVzO1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlckRlZmluZWRTdHlsZSkge1xuICAgICAgdXNlclN0eWxlcyA9IHRoaXMub3B0aW9ucy51c2VyRGVmaW5lZFN0eWxlKGZlYXR1cmUpO1xuICAgIH1cbiAgICAvLyBmaW5kIHRoZSBzeW1ib2wgdG8gcmVwcmVzZW50IHRoaXMgZmVhdHVyZVxuICAgIHZhciBzeW0gPSB0aGlzLl9nZXRTeW1ib2woZmVhdHVyZSk7XG4gICAgaWYgKHN5bSkge1xuICAgICAgcmV0dXJuIHRoaXMubWVyZ2VTdHlsZXMoc3ltLnN0eWxlKGZlYXR1cmUsIHRoaXMuX3Zpc3VhbFZhcmlhYmxlcyksIHVzZXJTdHlsZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZpc2libGUgc3ltYm9sb2d5XG4gICAgICByZXR1cm4gdGhpcy5tZXJnZVN0eWxlcyh7b3BhY2l0eTogMCwgZmlsbE9wYWNpdHk6IDB9LCB1c2VyU3R5bGVzKTtcbiAgICB9XG4gIH0sXG5cbiAgbWVyZ2VTdHlsZXM6IGZ1bmN0aW9uIChzdHlsZXMsIHVzZXJTdHlsZXMpIHtcbiAgICB2YXIgbWVyZ2VkU3R5bGVzID0ge307XG4gICAgdmFyIGF0dHI7XG4gICAgLy8gY29weSByZW5kZXJlciBzdHlsZSBhdHRyaWJ1dGVzXG4gICAgZm9yIChhdHRyIGluIHN0eWxlcykge1xuICAgICAgaWYgKHN0eWxlcy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICBtZXJnZWRTdHlsZXNbYXR0cl0gPSBzdHlsZXNbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICAgIC8vIG92ZXJyaWRlIHdpdGggdXNlciBkZWZpbmVkIHN0eWxlIGF0dHJpYnV0ZXNcbiAgICBpZiAodXNlclN0eWxlcykge1xuICAgICAgZm9yIChhdHRyIGluIHVzZXJTdHlsZXMpIHtcbiAgICAgICAgaWYgKHVzZXJTdHlsZXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICBtZXJnZWRTdHlsZXNbYXR0cl0gPSB1c2VyU3R5bGVzW2F0dHJdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtZXJnZWRTdHlsZXM7XG4gIH1cbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBSZW5kZXJlcjtcbiIsImltcG9ydCBSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVyJztcblxuZXhwb3J0IHZhciBTaW1wbGVSZW5kZXJlciA9IFJlbmRlcmVyLmV4dGVuZCh7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgICBSZW5kZXJlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fY3JlYXRlU3ltYm9sKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24uc3ltYm9sKSB7XG4gICAgICB0aGlzLl9zeW1ib2xzLnB1c2godGhpcy5fbmV3U3ltYm9sKHRoaXMuX3JlbmRlcmVySnNvbi5zeW1ib2wpKTtcbiAgICB9XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9zeW1ib2xzWzBdO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNpbXBsZVJlbmRlcmVyIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBTaW1wbGVSZW5kZXJlcihyZW5kZXJlckpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBzaW1wbGVSZW5kZXJlcjtcbiIsImltcG9ydCBSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVyJztcblxuZXhwb3J0IHZhciBDbGFzc0JyZWFrc1JlbmRlcmVyID0gUmVuZGVyZXIuZXh0ZW5kKHtcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICAgIFJlbmRlcmVyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgcmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbiAgICB0aGlzLl9maWVsZCA9IHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZDtcbiAgICBpZiAodGhpcy5fcmVuZGVyZXJKc29uLm5vcm1hbGl6YXRpb25UeXBlICYmIHRoaXMuX3JlbmRlcmVySnNvbi5ub3JtYWxpemF0aW9uVHlwZSA9PT0gJ2VzcmlOb3JtYWxpemVCeUZpZWxkJykge1xuICAgICAgdGhpcy5fbm9ybWFsaXphdGlvbkZpZWxkID0gdGhpcy5fcmVuZGVyZXJKc29uLm5vcm1hbGl6YXRpb25GaWVsZDtcbiAgICB9XG4gICAgdGhpcy5fY3JlYXRlU3ltYm9scygpO1xuICB9LFxuXG4gIF9jcmVhdGVTeW1ib2xzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN5bWJvbDtcbiAgICB2YXIgY2xhc3NicmVha3MgPSB0aGlzLl9yZW5kZXJlckpzb24uY2xhc3NCcmVha0luZm9zO1xuXG4gICAgdGhpcy5fc3ltYm9scyA9IFtdO1xuXG4gICAgLy8gY3JlYXRlIGEgc3ltYm9sIGZvciBlYWNoIGNsYXNzIGJyZWFrXG4gICAgZm9yICh2YXIgaSA9IGNsYXNzYnJlYWtzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLnByb3BvcnRpb25hbFBvbHlnb24gJiYgdGhpcy5fcmVuZGVyZXJKc29uLmJhY2tncm91bmRGaWxsU3ltYm9sKSB7XG4gICAgICAgIHN5bWJvbCA9IHRoaXMuX25ld1N5bWJvbCh0aGlzLl9yZW5kZXJlckpzb24uYmFja2dyb3VuZEZpbGxTeW1ib2wpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3ltYm9sID0gdGhpcy5fbmV3U3ltYm9sKGNsYXNzYnJlYWtzW2ldLnN5bWJvbCk7XG4gICAgICB9XG4gICAgICBzeW1ib2wudmFsID0gY2xhc3NicmVha3NbaV0uY2xhc3NNYXhWYWx1ZTtcbiAgICAgIHRoaXMuX3N5bWJvbHMucHVzaChzeW1ib2wpO1xuICAgIH1cbiAgICAvLyBzb3J0IHRoZSBzeW1ib2xzIGluIGFzY2VuZGluZyB2YWx1ZVxuICAgIHRoaXMuX3N5bWJvbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgcmV0dXJuIGEudmFsID4gYi52YWwgPyAxIDogLTE7XG4gICAgfSk7XG4gICAgdGhpcy5fY3JlYXRlRGVmYXVsdFN5bWJvbCgpO1xuICAgIHRoaXMuX21heFZhbHVlID0gdGhpcy5fc3ltYm9sc1t0aGlzLl9zeW1ib2xzLmxlbmd0aCAtIDFdLnZhbDtcbiAgfSxcblxuICBfZ2V0U3ltYm9sOiBmdW5jdGlvbiAoZmVhdHVyZSkge1xuICAgIHZhciB2YWwgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fZmllbGRdO1xuICAgIGlmICh0aGlzLl9ub3JtYWxpemF0aW9uRmllbGQpIHtcbiAgICAgIHZhciBub3JtVmFsdWUgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fbm9ybWFsaXphdGlvbkZpZWxkXTtcbiAgICAgIGlmICghaXNOYU4obm9ybVZhbHVlKSAmJiBub3JtVmFsdWUgIT09IDApIHtcbiAgICAgICAgdmFsID0gdmFsIC8gbm9ybVZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRTeW1ib2w7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHZhbCA+IHRoaXMuX21heFZhbHVlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVmYXVsdFN5bWJvbDtcbiAgICB9XG4gICAgdmFyIHN5bWJvbCA9IHRoaXMuX3N5bWJvbHNbMF07XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX3N5bWJvbHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh2YWwgPiB0aGlzLl9zeW1ib2xzW2ldLnZhbCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHN5bWJvbCA9IHRoaXMuX3N5bWJvbHNbaV07XG4gICAgfVxuICAgIHJldHVybiBzeW1ib2w7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NCcmVha3NSZW5kZXJlciAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgQ2xhc3NCcmVha3NSZW5kZXJlcihyZW5kZXJlckpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzc0JyZWFrc1JlbmRlcmVyO1xuIiwiaW1wb3J0IFJlbmRlcmVyIGZyb20gJy4vUmVuZGVyZXInO1xuXG5leHBvcnQgdmFyIFVuaXF1ZVZhbHVlUmVuZGVyZXIgPSBSZW5kZXJlci5leHRlbmQoe1xuICBpbml0aWFsaXplOiBmdW5jdGlvbiAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gICAgUmVuZGVyZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCByZW5kZXJlckpzb24sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2ZpZWxkID0gdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkMTtcbiAgICB0aGlzLl9jcmVhdGVTeW1ib2xzKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVN5bWJvbHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3ltYm9sO1xuICAgIHZhciB1bmlxdWVzID0gdGhpcy5fcmVuZGVyZXJKc29uLnVuaXF1ZVZhbHVlSW5mb3M7XG5cbiAgICAvLyBjcmVhdGUgYSBzeW1ib2wgZm9yIGVhY2ggdW5pcXVlIHZhbHVlXG4gICAgZm9yICh2YXIgaSA9IHVuaXF1ZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHN5bWJvbCA9IHRoaXMuX25ld1N5bWJvbCh1bmlxdWVzW2ldLnN5bWJvbCk7XG4gICAgICBzeW1ib2wudmFsID0gdW5pcXVlc1tpXS52YWx1ZTtcbiAgICAgIHRoaXMuX3N5bWJvbHMucHVzaChzeW1ib2wpO1xuICAgIH1cbiAgICB0aGlzLl9jcmVhdGVEZWZhdWx0U3ltYm9sKCk7XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKGZlYXR1cmUpIHtcbiAgICB2YXIgdmFsID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX2ZpZWxkXTtcbiAgICAvLyBhY2N1bXVsYXRlIHZhbHVlcyBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGZpZWxkIGRlZmluZWRcbiAgICBpZiAodGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkRGVsaW1pdGVyICYmIHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZDIpIHtcbiAgICAgIHZhciB2YWwyID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX3JlbmRlcmVySnNvbi5maWVsZDJdO1xuICAgICAgaWYgKHZhbDIpIHtcbiAgICAgICAgdmFsICs9IHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZERlbGltaXRlciArIHZhbDI7XG4gICAgICAgIHZhciB2YWwzID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX3JlbmRlcmVySnNvbi5maWVsZDNdO1xuICAgICAgICBpZiAodmFsMykge1xuICAgICAgICAgIHZhbCArPSB0aGlzLl9yZW5kZXJlckpzb24uZmllbGREZWxpbWl0ZXIgKyB2YWwzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHN5bWJvbCA9IHRoaXMuX2RlZmF1bHRTeW1ib2w7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX3N5bWJvbHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIC8vIHVzaW5nIHRoZSA9PT0gb3BlcmF0b3IgZG9lcyBub3Qgd29yayBpZiB0aGUgZmllbGRcbiAgICAgIC8vIG9mIHRoZSB1bmlxdWUgcmVuZGVyZXIgaXMgbm90IGEgc3RyaW5nXG4gICAgICAvKmVzbGludC1kaXNhYmxlICovXG4gICAgICBpZiAodGhpcy5fc3ltYm9sc1tpXS52YWwgPT0gdmFsKSB7XG4gICAgICAgIHN5bWJvbCA9IHRoaXMuX3N5bWJvbHNbaV07XG4gICAgICB9XG4gICAgICAvKmVzbGludC1lbmFibGUgKi9cbiAgICB9XG4gICAgcmV0dXJuIHN5bWJvbDtcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxdWVWYWx1ZVJlbmRlcmVyIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBVbmlxdWVWYWx1ZVJlbmRlcmVyKHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHVuaXF1ZVZhbHVlUmVuZGVyZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcblxuaW1wb3J0IGNsYXNzQnJlYWtzUmVuZGVyZXIgZnJvbSAnLi9SZW5kZXJlcnMvQ2xhc3NCcmVha3NSZW5kZXJlcic7XG5pbXBvcnQgdW5pcXVlVmFsdWVSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVycy9VbmlxdWVWYWx1ZVJlbmRlcmVyJztcbmltcG9ydCBzaW1wbGVSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlcic7XG5cbkwuZXNyaS5GZWF0dXJlTGF5ZXIuYWRkSW5pdEhvb2soZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5vcHRpb25zLmlnbm9yZVJlbmRlcmVyKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBvbGRPbkFkZCA9IEwuVXRpbC5iaW5kKHRoaXMub25BZGQsIHRoaXMpO1xuICB2YXIgb2xkVW5iaW5kUG9wdXAgPSBMLlV0aWwuYmluZCh0aGlzLnVuYmluZFBvcHVwLCB0aGlzKTtcbiAgdmFyIG9sZE9uUmVtb3ZlID0gTC5VdGlsLmJpbmQodGhpcy5vblJlbW92ZSwgdGhpcyk7XG4gIEwuVXRpbC5iaW5kKHRoaXMuY3JlYXRlTmV3TGF5ZXIsIHRoaXMpO1xuXG4gIHRoaXMub25BZGQgPSBmdW5jdGlvbiAobWFwKSB7XG4gICAgdGhpcy5tZXRhZGF0YShmdW5jdGlvbiAoZXJyb3IsIHJlc3BvbnNlKSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdmYWlsZWQgdG8gbG9hZCBtZXRhZGF0YSBmcm9tIHRoZSBzZXJ2aWNlLicpO1xuICAgICAgICByZXR1cm5cbiAgICAgIH0gaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLmRyYXdpbmdJbmZvKSB7XG4gICAgICAgIGlmKHRoaXMub3B0aW9ucy5kcmF3aW5nSW5mbykge1xuICAgICAgICAgIC8vIGFsbG93IEwuZXNyaS53ZWJtYXAgKGFuZCBvdGhlcnMpIHRvIG92ZXJyaWRlIHNlcnZpY2Ugc3ltYm9sb2d5IHdpdGggaW5mbyBwcm92aWRlZCBpbiBsYXllciBjb25zdHJ1Y3RvclxuICAgICAgICAgIHZhciBzZXJ2aWNlTWV0YWRhdGEgPSByZXNwb25zZTtcbiAgICAgICAgICBzZXJ2aWNlTWV0YWRhdGEuZHJhd2luZ0luZm8gPSB0aGlzLm9wdGlvbnMuZHJhd2luZ0luZm87XG4gICAgICAgICAgdGhpcy5fc2V0UmVuZGVyZXJzKHNlcnZpY2VNZXRhZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fc2V0UmVuZGVyZXJzKHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zZXRSZW5kZXJlcnMocmVzcG9uc2UpO1xuICAgICAgICBvbGRPbkFkZChtYXApO1xuICAgICAgICB0aGlzLl9hZGRQb2ludExheWVyKG1hcCk7XG4gICAgICB9XG4gICAgfSwgdGhpcyk7XG4gIH07XG5cbiAgdGhpcy5vblJlbW92ZSA9IGZ1bmN0aW9uIChtYXApIHtcbiAgICBvbGRPblJlbW92ZShtYXApO1xuICAgIGlmICh0aGlzLl9wb2ludExheWVyKSB7XG4gICAgICB2YXIgcG9pbnRMYXllcnMgPSB0aGlzLl9wb2ludExheWVyLmdldExheWVycygpO1xuICAgICAgZm9yICh2YXIgaSBpbiBwb2ludExheWVycykge1xuICAgICAgICBtYXAucmVtb3ZlTGF5ZXIocG9pbnRMYXllcnNbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICB0aGlzLnVuYmluZFBvcHVwID0gZnVuY3Rpb24gKCkge1xuICAgIG9sZFVuYmluZFBvcHVwKCk7XG4gICAgaWYgKHRoaXMuX3BvaW50TGF5ZXIpIHtcbiAgICAgIHZhciBwb2ludExheWVycyA9IHRoaXMuX3BvaW50TGF5ZXIuZ2V0TGF5ZXJzKCk7XG4gICAgICBmb3IgKHZhciBpIGluIHBvaW50TGF5ZXJzKSB7XG4gICAgICAgIHBvaW50TGF5ZXJzW2ldLnVuYmluZFBvcHVwKCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHRoaXMuX2FkZFBvaW50TGF5ZXIgPSBmdW5jdGlvbiAobWFwKSB7XG4gICAgaWYgKHRoaXMuX3BvaW50TGF5ZXIpIHtcbiAgICAgIHRoaXMuX3BvaW50TGF5ZXIuYWRkVG8obWFwKTtcbiAgICAgIHRoaXMuX3BvaW50TGF5ZXIuYnJpbmdUb0Zyb250KCk7XG4gICAgfVxuICB9O1xuXG4gIHRoaXMuX2NyZWF0ZVBvaW50TGF5ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLl9wb2ludExheWVyKSB7XG4gICAgICB0aGlzLl9wb2ludExheWVyID0gTC5nZW9Kc29uKCk7XG4gICAgICAvLyBzdG9yZSB0aGUgZmVhdHVyZSBpZHMgdGhhdCBoYXZlIGFscmVhZHkgYmVlbiBhZGRlZCB0byB0aGUgbWFwXG4gICAgICB0aGlzLl9wb2ludExheWVySWRzID0ge307XG5cbiAgICAgIGlmICh0aGlzLl9wb3B1cCkge1xuICAgICAgICB2YXIgcG9wdXBGdW5jdGlvbiA9IGZ1bmN0aW9uIChmZWF0dXJlLCBsYXllcikge1xuICAgICAgICAgIGxheWVyLmJpbmRQb3B1cCh0aGlzLl9wb3B1cChmZWF0dXJlLCBsYXllciksIHRoaXMuX3BvcHVwT3B0aW9ucyk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX3BvaW50TGF5ZXIub3B0aW9ucy5vbkVhY2hGZWF0dXJlID0gTC5VdGlsLmJpbmQocG9wdXBGdW5jdGlvbiwgdGhpcyk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHRoaXMuY3JlYXRlTmV3TGF5ZXIgPSBmdW5jdGlvbiAoZ2VvanNvbikge1xuICAgIHZhciBmTGF5ZXIgPSBMLkdlb0pTT04uZ2VvbWV0cnlUb0xheWVyKGdlb2pzb24sIHRoaXMub3B0aW9ucyk7XG5cbiAgICAvLyBhZGQgYSBwb2ludCBsYXllciB3aGVuIHRoZSBwb2x5Z29uIGlzIHJlcHJlc2VudGVkIGFzIHByb3BvcnRpb25hbCBtYXJrZXIgc3ltYm9sc1xuICAgIGlmICh0aGlzLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzKSB7XG4gICAgICB2YXIgY2VudHJvaWQgPSB0aGlzLmdldFBvbHlnb25DZW50cm9pZChnZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzKTtcbiAgICAgIGlmICghKGlzTmFOKGNlbnRyb2lkWzBdKSB8fCBpc05hTihjZW50cm9pZFswXSkpKSB7XG4gICAgICAgIHRoaXMuX2NyZWF0ZVBvaW50TGF5ZXIoKTtcblxuICAgICAgICB2YXIgZmVhdHVyZUlkID0gZ2VvanNvbi5pZC50b1N0cmluZygpO1xuICAgICAgICAvLyBvbmx5IGFkZCB0aGUgZmVhdHVyZSBpZiBpdCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0IG9uIHRoZSBtYXBcbiAgICAgICAgaWYgKCF0aGlzLl9wb2ludExheWVySWRzW2ZlYXR1cmVJZF0pIHtcbiAgICAgICAgICB2YXIgcG9pbnRqc29uID0gdGhpcy5nZXRQb2ludEpzb24oZ2VvanNvbiwgY2VudHJvaWQpO1xuXG4gICAgICAgICAgdGhpcy5fcG9pbnRMYXllci5hZGREYXRhKHBvaW50anNvbik7XG4gICAgICAgICAgdGhpcy5fcG9pbnRMYXllcklkc1tmZWF0dXJlSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3BvaW50TGF5ZXIuYnJpbmdUb0Zyb250KCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmTGF5ZXI7XG4gIH07XG5cbiAgdGhpcy5nZXRQb2x5Z29uQ2VudHJvaWQgPSBmdW5jdGlvbiAoY29vcmRpbmF0ZXMpIHtcbiAgICB2YXIgcHRzID0gY29vcmRpbmF0ZXNbMF1bMF07XG4gICAgaWYgKHB0cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIHB0cyA9IGNvb3JkaW5hdGVzWzBdO1xuICAgIH1cblxuICAgIHZhciB0d2ljZWFyZWEgPSAwO1xuICAgIHZhciB4ID0gMDtcbiAgICB2YXIgeSA9IDA7XG4gICAgdmFyIG5QdHMgPSBwdHMubGVuZ3RoO1xuICAgIHZhciBwMTtcbiAgICB2YXIgcDI7XG4gICAgdmFyIGY7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgaiA9IG5QdHMgLSAxOyBpIDwgblB0czsgaiA9IGkrKykge1xuICAgICAgcDEgPSBwdHNbaV07IHAyID0gcHRzW2pdO1xuICAgICAgdHdpY2VhcmVhICs9IHAxWzBdICogcDJbMV07XG4gICAgICB0d2ljZWFyZWEgLT0gcDFbMV0gKiBwMlswXTtcbiAgICAgIGYgPSBwMVswXSAqIHAyWzFdIC0gcDJbMF0gKiBwMVsxXTtcbiAgICAgIHggKz0gKHAxWzBdICsgcDJbMF0pICogZjtcbiAgICAgIHkgKz0gKHAxWzFdICsgcDJbMV0pICogZjtcbiAgICB9XG4gICAgZiA9IHR3aWNlYXJlYSAqIDM7XG4gICAgcmV0dXJuIFt4IC8gZiwgeSAvIGZdO1xuICB9O1xuXG4gIHRoaXMuZ2V0UG9pbnRKc29uID0gZnVuY3Rpb24gKGdlb2pzb24sIGNlbnRyb2lkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICAgIHByb3BlcnRpZXM6IGdlb2pzb24ucHJvcGVydGllcyxcbiAgICAgIGlkOiBnZW9qc29uLmlkLFxuICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgICAgY29vcmRpbmF0ZXM6IFtjZW50cm9pZFswXSwgY2VudHJvaWRbMV1dXG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICB0aGlzLl9jaGVja0ZvclByb3BvcnRpb25hbFN5bWJvbHMgPSBmdW5jdGlvbiAoZ2VvbWV0cnlUeXBlLCByZW5kZXJlcikge1xuICAgIHRoaXMuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSBmYWxzZTtcbiAgICBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5UG9seWdvbicpIHtcbiAgICAgIGlmIChyZW5kZXJlci5iYWNrZ3JvdW5kRmlsbFN5bWJvbCkge1xuICAgICAgICB0aGlzLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIHRvIHNlZSBpZiB0aGUgZmlyc3Qgc3ltYm9sIGluIHRoZSBjbGFzc2JyZWFrcyBpcyBhIG1hcmtlciBzeW1ib2xcbiAgICAgIGlmIChyZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MgJiYgcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zLmxlbmd0aCkge1xuICAgICAgICB2YXIgc3ltID0gcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zWzBdLnN5bWJvbDtcbiAgICAgICAgaWYgKHN5bSAmJiAoc3ltLnR5cGUgPT09ICdlc3JpU01TJyB8fCBzeW0udHlwZSA9PT0gJ2VzcmlQTVMnKSkge1xuICAgICAgICAgIHRoaXMuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHRoaXMuX3NldFJlbmRlcmVycyA9IGZ1bmN0aW9uIChnZW9qc29uKSB7XG4gICAgdmFyIHJlbmQ7XG4gICAgdmFyIHJlbmRlcmVySW5mbyA9IGdlb2pzb24uZHJhd2luZ0luZm8ucmVuZGVyZXI7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdGhpcy5vcHRpb25zLnVybFxuICAgIH07XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnRva2VuKSB7XG4gICAgICBvcHRpb25zLnRva2VuID0gdGhpcy5vcHRpb25zLnRva2VuO1xuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLnBhbmUpIHtcbiAgICAgIG9wdGlvbnMucGFuZSA9IHRoaXMub3B0aW9ucy5wYW5lO1xuICAgIH1cbiAgICBpZiAoZ2VvanNvbi5kcmF3aW5nSW5mby50cmFuc3BhcmVuY3kpIHtcbiAgICAgIG9wdGlvbnMubGF5ZXJUcmFuc3BhcmVuY3kgPSBnZW9qc29uLmRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeTtcbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHlsZSkge1xuICAgICAgb3B0aW9ucy51c2VyRGVmaW5lZFN0eWxlID0gdGhpcy5vcHRpb25zLnN0eWxlO1xuICAgIH1cblxuICAgIHN3aXRjaCAocmVuZGVyZXJJbmZvLnR5cGUpIHtcbiAgICAgIGNhc2UgJ2NsYXNzQnJlYWtzJzpcbiAgICAgICAgdGhpcy5fY2hlY2tGb3JQcm9wb3J0aW9uYWxTeW1ib2xzKGdlb2pzb24uZ2VvbWV0cnlUeXBlLCByZW5kZXJlckluZm8pO1xuICAgICAgICBpZiAodGhpcy5faGFzUHJvcG9ydGlvbmFsU3ltYm9scykge1xuICAgICAgICAgIHRoaXMuX2NyZWF0ZVBvaW50TGF5ZXIoKTtcbiAgICAgICAgICB2YXIgcFJlbmQgPSBjbGFzc0JyZWFrc1JlbmRlcmVyKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XG4gICAgICAgICAgcFJlbmQuYXR0YWNoU3R5bGVzVG9MYXllcih0aGlzLl9wb2ludExheWVyKTtcbiAgICAgICAgICBvcHRpb25zLnByb3BvcnRpb25hbFBvbHlnb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJlbmQgPSBjbGFzc0JyZWFrc1JlbmRlcmVyKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAndW5pcXVlVmFsdWUnOlxuICAgICAgICByZW5kID0gdW5pcXVlVmFsdWVSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJlbmQgPSBzaW1wbGVSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZW5kLmF0dGFjaFN0eWxlc1RvTGF5ZXIodGhpcyk7XG4gIH07XG5cbiAgdGhpcy5tZXRhZGF0YShmdW5jdGlvbiAoZXJyb3IsIHJlc3BvbnNlKSB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UuZHJhd2luZ0luZm8pIHtcbiAgICAgIC8vIGlmIGRyYXdpbmdJbmZvIGZyb20gYSB3ZWJtYXAgaXMgc3VwcGxpZWQgaW4gdGhlIGxheWVyIGNvbnN0cnVjdG9yLCB1c2UgdGhhdCBpbnN0ZWFkXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmRyYXdpbmdJbmZvKSB7XG4gICAgICAgIHJlc3BvbnNlLmRyYXdpbmdJbmZvID0gdGhpcy5vcHRpb25zLmRyYXdpbmdJbmZvO1xuICAgICAgfVxuICAgICAgdGhpcy5fc2V0UmVuZGVyZXJzKHJlc3BvbnNlKTtcbiAgICB9IGlmICh0aGlzLl9hbHJlYWR5QWRkZWQpIHtcbiAgICAgIHRoaXMuc2V0U3R5bGUodGhpcy5fb3JpZ2luYWxTdHlsZSk7XG4gICAgfVxuICB9LCB0aGlzKTtcbn0pO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcblxyXG5pbXBvcnQgeyBjbGFzc0JyZWFrc1JlbmRlcmVyLCB1bmlxdWVWYWx1ZVJlbmRlcmVyLCBzaW1wbGVSZW5kZXJlciB9IGZyb20gJ2VzcmktbGVhZmxldC1yZW5kZXJlcnMnO1xyXG5cclxuZXhwb3J0IHZhciBGZWF0dXJlQ29sbGVjdGlvbiA9IEwuR2VvSlNPTi5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIGRhdGE6IHt9LCAvLyBFc3JpIEZlYXR1cmUgQ29sbGVjdGlvbiBKU09OIG9yIEl0ZW0gSURcclxuICAgIG9wYWNpdHk6IDEsXHJcbiAgICByZW5kZXJlcjoge31cclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF5ZXJzLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5kYXRhID0gdGhpcy5vcHRpb25zLmRhdGE7XHJcbiAgICB0aGlzLm9wYWNpdHkgPSB0aGlzLm9wdGlvbnMub3BhY2l0eTtcclxuICAgIHRoaXMucmVuZGVyZXIgPSB0aGlzLm9wdGlvbnMucmVuZGVyZXI7XHJcbiAgICB0aGlzLl9sYXllcnMgPSB7fTtcclxuXHJcbiAgICB2YXIgaSwgbGVuO1xyXG5cclxuICAgIGlmIChsYXllcnMpIHtcclxuICAgICAgZm9yIChpID0gMCwgbGVuID0gbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5hZGRMYXllcihsYXllcnNbaV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiB0aGlzLmRhdGEgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHRoaXMuX2dldEZlYXR1cmVDb2xsZWN0aW9uKHRoaXMuZGF0YSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uKHRoaXMuZGF0YSk7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgX2dldEZlYXR1cmVDb2xsZWN0aW9uOiBmdW5jdGlvbiAoaXRlbUlkKSB7XHJcbiAgICB2YXIgdXJsID0gJ2h0dHBzOi8vd3d3LmFyY2dpcy5jb20vc2hhcmluZy9yZXN0L2NvbnRlbnQvaXRlbXMvJyArIGl0ZW1JZCArICcvZGF0YSc7XHJcbiAgICBMLmVzcmkucmVxdWVzdCh1cmwsIHt9LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcclxuICAgICAgaWYgKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5fcGFyc2VGZWF0dXJlQ29sbGVjdGlvbihyZXMpO1xyXG4gICAgICB9XHJcbiAgICB9LCB0aGlzKTtcclxuICB9LFxyXG5cclxuICBfcGFyc2VGZWF0dXJlQ29sbGVjdGlvbjogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgIHZhciBmZWF0dXJlcyA9IGRhdGEubGF5ZXJzWzBdLmZlYXR1cmVTZXQuZmVhdHVyZXM7XHJcbiAgICB2YXIgZ2VvbWV0cnlUeXBlID0gZGF0YS5sYXllcnNbMF0ubGF5ZXJEZWZpbml0aW9uLmdlb21ldHJ5VHlwZTsgLy8gJ2VzcmlHZW9tZXRyeVBvaW50JyB8ICdlc3JpR2VvbWV0cnlNdWx0aXBvaW50JyB8ICdlc3JpR2VvbWV0cnlQb2x5bGluZScgfCAnZXNyaUdlb21ldHJ5UG9seWdvbicgfCAnZXNyaUdlb21ldHJ5RW52ZWxvcGUnXHJcbiAgICB2YXIgZ2VvanNvbiA9IHRoaXMuX2ZlYXR1cmVDb2xsZWN0aW9uVG9HZW9KU09OKGZlYXR1cmVzLCBnZW9tZXRyeVR5cGUpO1xyXG5cclxuICAgIHRoaXMuX3NldFJlbmRlcmVycyhkYXRhLmxheWVyc1swXS5sYXllckRlZmluaXRpb24pO1xyXG4gICAgdGhpcy5hZGREYXRhKGdlb2pzb24pO1xyXG4gIH0sXHJcblxyXG4gIF9mZWF0dXJlQ29sbGVjdGlvblRvR2VvSlNPTjogZnVuY3Rpb24gKGZlYXR1cmVzLCBnZW9tZXRyeVR5cGUpIHtcclxuICAgIHZhciBnZW9qc29uID0ge1xyXG4gICAgICB0eXBlOiAnRmVhdHVyZUNvbGxlY3Rpb24nLFxyXG4gICAgICBmZWF0dXJlczogW11cclxuICAgIH07XHJcbiAgICB2YXIgZmVhdHVyZXNBcnJheSA9IFtdO1xyXG4gICAgdmFyIGksIGxlbjtcclxuXHJcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICB2YXIgZjtcclxuICAgICAgdmFyIG1lcmNhdG9yVG9MYXRsbmcsIGNvb3JkaW5hdGVzO1xyXG4gICAgICB2YXIgaiwgaztcclxuXHJcbiAgICAgIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2ludCcpIHtcclxuICAgICAgICBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGZlYXR1cmVzW2ldLmdlb21ldHJ5LngsIGZlYXR1cmVzW2ldLmdlb21ldHJ5LnkpKTtcclxuICAgICAgICBjb29yZGluYXRlcyA9IFttZXJjYXRvclRvTGF0bG5nLmxuZywgbWVyY2F0b3JUb0xhdGxuZy5sYXRdO1xyXG5cclxuICAgICAgICBmID0ge1xyXG4gICAgICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxyXG4gICAgICAgICAgZ2VvbWV0cnk6IHsgdHlwZTogJ1BvaW50JywgY29vcmRpbmF0ZXM6IGNvb3JkaW5hdGVzIH0sXHJcbiAgICAgICAgICBwcm9wZXJ0aWVzOiBmZWF0dXJlc1tpXS5hdHRyaWJ1dGVzXHJcbiAgICAgICAgfTtcclxuICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlNdWx0aXBvaW50Jykge1xyXG4gICAgICAgIHZhciBwbGVuO1xyXG4gICAgICAgIHZhciBwb2ludHMgPSBbXTtcclxuXHJcbiAgICAgICAgZm9yIChqID0gMCwgcGxlbiA9IGZlYXR1cmVzW2ldLmdlb21ldHJ5LnBvaW50cy5sZW5ndGg7IGogPCBwbGVuOyBqKyspIHtcclxuICAgICAgICAgIG1lcmNhdG9yVG9MYXRsbmcgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoZmVhdHVyZXNbaV0uZ2VvbWV0cnkucG9pbnRzW2pdWzBdLCBmZWF0dXJlc1tpXS5nZW9tZXRyeS5wb2ludHNbal1bMV0pKTtcclxuICAgICAgICAgIGNvb3JkaW5hdGVzID0gW21lcmNhdG9yVG9MYXRsbmcubG5nLCBtZXJjYXRvclRvTGF0bG5nLmxhdF07XHJcbiAgICAgICAgICBwb2ludHMucHVzaChjb29yZGluYXRlcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmID0ge1xyXG4gICAgICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxyXG4gICAgICAgICAgZ2VvbWV0cnk6IHsgdHlwZTogJ011bHRpUG9pbnQnLCBjb29yZGluYXRlczogcG9pbnRzIH0sXHJcbiAgICAgICAgICBwcm9wZXJ0aWVzOiBmZWF0dXJlc1tpXS5hdHRyaWJ1dGVzXHJcbiAgICAgICAgfTtcclxuICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2x5bGluZScpIHtcclxuICAgICAgICB2YXIgcGF0aGxlbiwgcGF0aHNsZW47XHJcbiAgICAgICAgdmFyIHBhdGhzID0gW107XHJcblxyXG4gICAgICAgIGZvciAoaiA9IDAsIHBhdGhzbGVuID0gZmVhdHVyZXNbaV0uZ2VvbWV0cnkucGF0aHMubGVuZ3RoOyBqIDwgcGF0aHNsZW47IGorKykge1xyXG4gICAgICAgICAgdmFyIHBhdGggPSBbXTtcclxuICAgICAgICAgIGZvciAoayA9IDAsIHBhdGhsZW4gPSBmZWF0dXJlc1tpXS5nZW9tZXRyeS5wYXRoc1tqXS5sZW5ndGg7IGsgPCBwYXRobGVuOyBrKyspIHtcclxuICAgICAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmZWF0dXJlc1tpXS5nZW9tZXRyeS5wYXRoc1tqXVtrXVswXSwgZmVhdHVyZXNbaV0uZ2VvbWV0cnkucGF0aHNbal1ba11bMV0pKTtcclxuICAgICAgICAgICAgY29vcmRpbmF0ZXMgPSBbbWVyY2F0b3JUb0xhdGxuZy5sbmcsIG1lcmNhdG9yVG9MYXRsbmcubGF0XTtcclxuICAgICAgICAgICAgcGF0aC5wdXNoKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHBhdGhzLnB1c2gocGF0aCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmID0ge1xyXG4gICAgICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxyXG4gICAgICAgICAgZ2VvbWV0cnk6IHsgdHlwZTogJ011bHRpTGluZVN0cmluZycsIGNvb3JkaW5hdGVzOiBwYXRocyB9LFxyXG4gICAgICAgICAgcHJvcGVydGllczogZmVhdHVyZXNbaV0uYXR0cmlidXRlc1xyXG4gICAgICAgIH07XHJcbiAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5UG9seWdvbicpIHtcclxuICAgICAgICB2YXIgcmluZ2xlbiwgcmluZ3NsZW47XHJcbiAgICAgICAgdmFyIHJpbmdzID0gW107XHJcblxyXG4gICAgICAgIGZvciAoaiA9IDAsIHJpbmdzbGVuID0gZmVhdHVyZXNbaV0uZ2VvbWV0cnkucmluZ3MubGVuZ3RoOyBqIDwgcmluZ3NsZW47IGorKykge1xyXG4gICAgICAgICAgdmFyIHJpbmcgPSBbXTtcclxuICAgICAgICAgIGZvciAoayA9IDAsIHJpbmdsZW4gPSBmZWF0dXJlc1tpXS5nZW9tZXRyeS5yaW5nc1tqXS5sZW5ndGg7IGsgPCByaW5nbGVuOyBrKyspIHtcclxuICAgICAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmZWF0dXJlc1tpXS5nZW9tZXRyeS5yaW5nc1tqXVtrXVswXSwgZmVhdHVyZXNbaV0uZ2VvbWV0cnkucmluZ3Nbal1ba11bMV0pKTtcclxuICAgICAgICAgICAgY29vcmRpbmF0ZXMgPSBbbWVyY2F0b3JUb0xhdGxuZy5sbmcsIG1lcmNhdG9yVG9MYXRsbmcubGF0XTtcclxuICAgICAgICAgICAgcmluZy5wdXNoKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJpbmdzLnB1c2gocmluZyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmID0ge1xyXG4gICAgICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxyXG4gICAgICAgICAgZ2VvbWV0cnk6IHsgdHlwZTogJ011bHRpUG9seWdvbicsIGNvb3JkaW5hdGVzOiByaW5ncyB9LFxyXG4gICAgICAgICAgcHJvcGVydGllczogZmVhdHVyZXNbaV0uYXR0cmlidXRlc1xyXG4gICAgICAgIH07XHJcbiAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5RW52ZWxvcGUnKSB7XHJcblxyXG4gICAgICB9XHJcblxyXG4gICAgICBmZWF0dXJlc0FycmF5LnB1c2goZik7XHJcbiAgICB9XHJcblxyXG4gICAgZ2VvanNvbi5mZWF0dXJlcyA9IGZlYXR1cmVzQXJyYXk7XHJcblxyXG4gICAgcmV0dXJuIGdlb2pzb247XHJcbiAgfSxcclxuXHJcbiAgX2NoZWNrRm9yUHJvcG9ydGlvbmFsU3ltYm9sczogZnVuY3Rpb24gKGdlb21ldHJ5VHlwZSwgcmVuZGVyZXIpIHtcclxuICAgIHRoaXMuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSBmYWxzZTtcclxuICAgIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2x5Z29uJykge1xyXG4gICAgICBpZiAocmVuZGVyZXIuYmFja2dyb3VuZEZpbGxTeW1ib2wpIHtcclxuICAgICAgICB0aGlzLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgICAvLyBjaGVjayB0byBzZWUgaWYgdGhlIGZpcnN0IHN5bWJvbCBpbiB0aGUgY2xhc3NicmVha3MgaXMgYSBtYXJrZXIgc3ltYm9sXHJcbiAgICAgIGlmIChyZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MgJiYgcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zLmxlbmd0aCkge1xyXG4gICAgICAgIHZhciBzeW0gPSByZW5kZXJlci5jbGFzc0JyZWFrSW5mb3NbMF0uc3ltYm9sO1xyXG4gICAgICAgIGlmIChzeW0gJiYgKHN5bS50eXBlID09PSAnZXNyaVNNUycgfHwgc3ltLnR5cGUgPT09ICdlc3JpUE1TJykpIHtcclxuICAgICAgICAgIHRoaXMuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIF9zZXRSZW5kZXJlcnM6IGZ1bmN0aW9uIChsYXllckRlZmluaXRpb24pIHtcclxuICAgIHZhciByZW5kO1xyXG4gICAgdmFyIHJlbmRlcmVySW5mbyA9IHRoaXMucmVuZGVyZXI7XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnBhbmUpIHtcclxuICAgICAgb3B0aW9ucy5wYW5lID0gdGhpcy5vcHRpb25zLnBhbmU7XHJcbiAgICB9XHJcbiAgICBpZiAobGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeSkge1xyXG4gICAgICBvcHRpb25zLmxheWVyVHJhbnNwYXJlbmN5ID0gbGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeTtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3R5bGUpIHtcclxuICAgICAgb3B0aW9ucy51c2VyRGVmaW5lZFN0eWxlID0gdGhpcy5vcHRpb25zLnN0eWxlO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAocmVuZGVyZXJJbmZvLnR5cGUpIHtcclxuICAgICAgY2FzZSAnY2xhc3NCcmVha3MnOlxyXG4gICAgICAgIHRoaXMuX2NoZWNrRm9yUHJvcG9ydGlvbmFsU3ltYm9scyhsYXllckRlZmluaXRpb24uZ2VvbWV0cnlUeXBlLCByZW5kZXJlckluZm8pO1xyXG4gICAgICAgIGlmICh0aGlzLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzKSB7XHJcbiAgICAgICAgICB0aGlzLl9jcmVhdGVQb2ludExheWVyKCk7XHJcbiAgICAgICAgICB2YXIgcFJlbmQgPSBjbGFzc0JyZWFrc1JlbmRlcmVyKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XHJcbiAgICAgICAgICBwUmVuZC5hdHRhY2hTdHlsZXNUb0xheWVyKHRoaXMuX3BvaW50TGF5ZXIpO1xyXG4gICAgICAgICAgb3B0aW9ucy5wcm9wb3J0aW9uYWxQb2x5Z29uID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVuZCA9IGNsYXNzQnJlYWtzUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAndW5pcXVlVmFsdWUnOlxyXG4gICAgICAgIGNvbnNvbGUubG9nKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XHJcbiAgICAgICAgcmVuZCA9IHVuaXF1ZVZhbHVlUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZW5kID0gc2ltcGxlUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgIH1cclxuICAgIHJlbmQuYXR0YWNoU3R5bGVzVG9MYXllcih0aGlzKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGZlYXR1cmVDb2xsZWN0aW9uIChnZW9qc29uLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBGZWF0dXJlQ29sbGVjdGlvbihnZW9qc29uLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZmVhdHVyZUNvbGxlY3Rpb247XHJcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5cclxuZXhwb3J0IHZhciBMYWJlbE1hcmtlciA9IEwuTWFya2VyLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgcHJvcGVydGllczoge30sXHJcbiAgICBsYWJlbGluZ0luZm86IHt9LFxyXG4gICAgb2Zmc2V0OiBbMCwgMF1cclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcbiAgICB0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xyXG5cclxuICAgIHZhciBsYWJlbFRleHQgPSB0aGlzLl9jcmVhdGVMYWJlbFRleHQodGhpcy5vcHRpb25zLnByb3BlcnRpZXMsIHRoaXMub3B0aW9ucy5sYWJlbGluZ0luZm8pO1xyXG4gICAgdGhpcy5fc2V0TGFiZWxJY29uKGxhYmVsVGV4dCwgdGhpcy5vcHRpb25zLm9mZnNldCk7XHJcbiAgfSxcclxuXHJcbiAgX2NyZWF0ZUxhYmVsVGV4dDogZnVuY3Rpb24gKHByb3BlcnRpZXMsIGxhYmVsaW5nSW5mbykge1xyXG4gICAgdmFyIHIgPSAvXFxbKFteXFxdXSopXFxdL2c7XHJcbiAgICB2YXIgbGFiZWxUZXh0ID0gbGFiZWxpbmdJbmZvWzBdLmxhYmVsRXhwcmVzc2lvbjtcclxuXHJcbiAgICBsYWJlbFRleHQgPSBsYWJlbFRleHQucmVwbGFjZShyLCBmdW5jdGlvbiAocykge1xyXG4gICAgICB2YXIgbSA9IHIuZXhlYyhzKTtcclxuICAgICAgcmV0dXJuIHByb3BlcnRpZXNbbVsxXV07XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbGFiZWxUZXh0O1xyXG4gIH0sXHJcblxyXG4gIF9zZXRMYWJlbEljb246IGZ1bmN0aW9uICh0ZXh0LCBvZmZzZXQpIHtcclxuICAgIHZhciBpY29uID0gTC5kaXZJY29uKHtcclxuICAgICAgaWNvblNpemU6IG51bGwsXHJcbiAgICAgIGNsYXNzTmFtZTogJ2VzcmktbGVhZmxldC13ZWJtYXAtbGFiZWxzJyxcclxuICAgICAgaHRtbDogJzxkaXY+JyArIHRleHQgKyAnPC9kaXY+JyxcclxuICAgICAgaWNvbkFuY2hvcjogb2Zmc2V0XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNldEljb24oaWNvbik7XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsYWJlbE1hcmtlciAobGF0bG5nLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBMYWJlbE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBsYWJlbE1hcmtlcjtcclxuIiwiZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBvcHVwQ29udGVudCAocG9wdXBJbmZvLCBwcm9wZXJ0aWVzKSB7XHJcbiAgLy8gY29uc29sZS5sb2cocG9wdXBJbmZvLCBwcm9wZXJ0aWVzKTtcclxuICB2YXIgciA9IC9cXHsoW15cXF1dKilcXH0vZztcclxuICB2YXIgdGl0bGVUZXh0ID0gJyc7XHJcbiAgdmFyIGNvbnRlbnQgPSAnJztcclxuXHJcbiAgaWYgKHBvcHVwSW5mby50aXRsZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICB0aXRsZVRleHQgPSBwb3B1cEluZm8udGl0bGU7XHJcbiAgfVxyXG5cclxuICB0aXRsZVRleHQgPSB0aXRsZVRleHQucmVwbGFjZShyLCBmdW5jdGlvbiAocykge1xyXG4gICAgdmFyIG0gPSByLmV4ZWMocyk7XHJcbiAgICByZXR1cm4gcHJvcGVydGllc1ttWzFdXTtcclxuICB9KTtcclxuXHJcbiAgY29udGVudCA9ICc8ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LXRpdGxlXCI+PGg0PicgKyB0aXRsZVRleHQgKyAnPC9oND48L2Rpdj48ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LWRlc2NyaXB0aW9uXCIgc3R5bGU9XCJtYXgtaGVpZ2h0OjIwMHB4O292ZXJmbG93OmF1dG87XCI+JztcclxuXHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb3B1cEluZm8uZmllbGRJbmZvcy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLnZpc2libGUgPT09IHRydWUpIHtcclxuICAgICAgY29udGVudCArPSAnPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OmJvbGQ7Y29sb3I6Izk5OTttYXJnaW4tdG9wOjVweDt3b3JkLWJyZWFrOmJyZWFrLWFsbDtcIj4nICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWwgKyAnPC9kaXY+PHAgc3R5bGU9XCJtYXJnaW4tdG9wOjA7bWFyZ2luLWJvdHRvbTo1cHg7d29yZC1icmVhazpicmVhay1hbGw7XCI+JyArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXSArICc8L3A+JztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnRlbnQgKz0gJzwvZGl2Pic7XHJcblxyXG4gIGlmIChwb3B1cEluZm8ubWVkaWFJbmZvcy5sZW5ndGggPiAwKSB7XHJcbiAgICAvLyBJdCBkb2VzIG5vdCBzdXBwb3J0IG1lZGlhSW5mb3MgZm9yIHBvcHVwIGNvbnRlbnRzLlxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGNvbnRlbnQ7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgUG9wdXAgPSB7XHJcbiAgY3JlYXRlUG9wdXBDb250ZW50OiBjcmVhdGVQb3B1cENvbnRlbnRcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvcHVwO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuaW1wb3J0IHsgZmVhdHVyZUNvbGxlY3Rpb24gfSBmcm9tICcuL0ZlYXR1cmVDb2xsZWN0aW9uL0ZlYXR1cmVDb2xsZWN0aW9uJztcclxuaW1wb3J0IHsgbGFiZWxNYXJrZXIgfSBmcm9tICcuL0xhYmVsL0xhYmVsTWFya2VyJztcclxuaW1wb3J0IHsgY3JlYXRlUG9wdXBDb250ZW50IH0gZnJvbSAnLi9Qb3B1cC9Qb3B1cCc7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3BlcmF0aW9uYWxMYXllciAobGF5ZXIsIGxheWVycywgbWFwKSB7XHJcbiAgcmV0dXJuIF9nZW5lcmF0ZUVzcmlMYXllcihsYXllciwgbGF5ZXJzLCBtYXApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX2dlbmVyYXRlRXNyaUxheWVyIChsYXllciwgbGF5ZXJzLCBtYXApIHtcclxuICBjb25zb2xlLmxvZygnZ2VuZXJhdGVFc3JpTGF5ZXI6ICcsIGxheWVyLnRpdGxlLCBsYXllcik7XHJcbiAgdmFyIGx5cjtcclxuICB2YXIgbGFiZWxzID0gW107XHJcbiAgdmFyIGxhYmVsc0xheWVyO1xyXG5cclxuICBpZiAobGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gU3VwcG9ydGluZyBvbmx5IHBvaW50IGdlb21ldHJ5XHJcbiAgICBjb25zb2xlLmxvZygnY3JlYXRlIEZlYXR1cmVDb2xsZWN0aW9uJyk7XHJcblxyXG4gICAgaWYgKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICYmIGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5mZWF0dXJlU2V0KSB7XHJcbiAgICAgIGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5mZWF0dXJlU2V0LmZlYXR1cmVzLm1hcChmdW5jdGlvbiAoZmVhdHVyZSkge1xyXG4gICAgICAgIHZhciBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGZlYXR1cmUuZ2VvbWV0cnkueCwgZmVhdHVyZS5nZW9tZXRyeS55KSk7XHJcbiAgICAgICAgdmFyIGxhYmVsaW5nSW5mbyA9IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xyXG5cclxuICAgICAgICB2YXIgbGFiZWwgPSBsYWJlbE1hcmtlcihtZXJjYXRvclRvTGF0bG5nLCB7XHJcbiAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXHJcbiAgICAgICAgICBwcm9wZXJ0aWVzOiBmZWF0dXJlLmF0dHJpYnV0ZXMsXHJcbiAgICAgICAgICBsYWJlbGluZ0luZm86IGxhYmVsaW5nSW5mbyxcclxuICAgICAgICAgIG9mZnNldDogWzIwLCAyMF1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBseXIgPSBmZWF0dXJlQ29sbGVjdGlvbihbXSwge1xyXG4gICAgICBkYXRhOiBsYXllci5pdGVtSWQgfHwgbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24sXHJcbiAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHksXHJcbiAgICAgIHJlbmRlcmVyOiBsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbMF0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLFxyXG4gICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgIGlmIChsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbMF0ucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQobGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzWzBdLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAobGFiZWxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG4gICAgICBseXIgPSBMLmxheWVyR3JvdXAoW2x5ciwgbGFiZWxzTGF5ZXJdKTtcclxuICAgIH1cclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGQycsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTRmVhdHVyZUxheWVyJyAmJiBsYXllci5sYXllckRlZmluaXRpb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgdmFyIHdoZXJlID0gJzE9MSc7XHJcbiAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci50eXBlID09PSAnaGVhdG1hcCcpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEhlYXRtYXBMYXllcicpO1xyXG4gICAgICAgIHZhciBncmFkaWVudCA9IHt9O1xyXG5cclxuICAgICAgICBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuY29sb3JTdG9wcy5tYXAoZnVuY3Rpb24gKHN0b3ApIHtcclxuICAgICAgICAgIC8vIGdyYWRpZW50W3N0b3AucmF0aW9dID0gJ3JnYmEoJyArIHN0b3AuY29sb3JbMF0gKyAnLCcgKyBzdG9wLmNvbG9yWzFdICsgJywnICsgc3RvcC5jb2xvclsyXSArICcsJyArIChzdG9wLmNvbG9yWzNdLzI1NSkgKyAnKSc7XHJcbiAgICAgICAgICAvLyBncmFkaWVudFtNYXRoLnJvdW5kKHN0b3AucmF0aW8qMTAwKS8xMDBdID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xyXG4gICAgICAgICAgZ3JhZGllbnRbKE1hdGgucm91bmQoc3RvcC5yYXRpbyAqIDEwMCkgLyAxMDAgKyA2KSAvIDddID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBseXIgPSBMLmVzcmkuSGVhdC5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDIuMFxyXG4gICAgICAgIC8vIGx5ciA9IEwuZXNyaS5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDEuMFxyXG4gICAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgICBtaW5PcGFjaXR5OiAwLjUsXHJcbiAgICAgICAgICBtYXg6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5tYXhQaXhlbEludGVuc2l0eSxcclxuICAgICAgICAgIGJsdXI6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5ibHVyUmFkaXVzLFxyXG4gICAgICAgICAgcmFkaXVzOiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuYmx1clJhZGl1cyAqIDEuMyxcclxuICAgICAgICAgIGdyYWRpZW50OiBncmFkaWVudFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdITCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGx5cjtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllciAod2l0aCBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8pJyk7XHJcblxyXG4gICAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgd2hlcmUgPSBsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsYWJlbHNMYXllciA9IEwuZmVhdHVyZUdyb3VwKGxhYmVscyk7XHJcbiAgICAgICAgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XHJcbiAgICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICAgIHdoZXJlOiB3aGVyZSxcclxuICAgICAgICAgIGRyYXdpbmdJbmZvOiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8sXHJcbiAgICAgICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgICBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICB2YXIgbGFiZWxpbmdJbmZvID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuXHJcbiAgICAgICAgICAgICAgdmFyIGxhYmVsUG9zO1xyXG4gICAgICAgICAgICAgIHZhciBjZW50cmFsS2V5O1xyXG4gICAgICAgICAgICAgIHZhciBjLCBjMjtcclxuICAgICAgICAgICAgICB2YXIgb2Zmc2V0ID0gWzAsIDBdO1xyXG5cclxuICAgICAgICAgICAgICBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcclxuICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzLnJldmVyc2UoKTtcclxuICAgICAgICAgICAgICAgIG9mZnNldCA9IFsyMCwgMjBdO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgYyA9IGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcclxuICAgICAgICAgICAgICAgIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGMubGVuZ3RoIC8gMik7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IGNbY2VudHJhbEtleV0ucmV2ZXJzZSgpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICBjID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xyXG4gICAgICAgICAgICAgICAgY2VudHJhbEtleSA9IE1hdGgucm91bmQoYy5sZW5ndGggLyAyKTtcclxuICAgICAgICAgICAgICAgIGMyID0gY1tjZW50cmFsS2V5XTtcclxuICAgICAgICAgICAgICAgIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGMyLmxlbmd0aCAvIDIpO1xyXG5cclxuICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gYzJbY2VudHJhbEtleV0ucmV2ZXJzZSgpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IGwuZ2V0Qm91bmRzKCkuZ2V0Q2VudGVyKCk7XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICB2YXIgbGFiZWwgPSBsYWJlbE1hcmtlcihsYWJlbFBvcywge1xyXG4gICAgICAgICAgICAgICAgekluZGV4T2Zmc2V0OiAxLFxyXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogZ2VvanNvbi5wcm9wZXJ0aWVzLFxyXG4gICAgICAgICAgICAgICAgbGFiZWxpbmdJbmZvOiBsYWJlbGluZ0luZm8sXHJcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IG9mZnNldFxyXG4gICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICBsYWJlbHNMYXllci5hZGRMYXllcihsYWJlbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbHlyID0gTC5sYXllckdyb3VwKFtseXIsIGxhYmVsc0xheWVyXSk7XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllciAod2l0aG91dCBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8pJyk7XHJcblxyXG4gICAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICB3aGVyZSA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbjtcclxuICAgICAgfVxyXG5cclxuICAgICAgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XHJcbiAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgd2hlcmU6IHdoZXJlLFxyXG4gICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgcmV0dXJuIGx5cjtcclxuICAgIH1cclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU0ZlYXR1cmVMYXllcicpIHtcclxuICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyJyk7XHJcbiAgICBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgaWYgKGxheWVyLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBwb2ludFRvTGF5ZXI6IGZ1bmN0aW9uIChnZW9qc29uLCBsYXRsbmcpIHtcclxuICAgICAgICB2YXIgZiA9IEwubWFya2VyKGxhdGxuZywge1xyXG4gICAgICAgICAgLy8gaWNvbjogaWNvbixcclxuICAgICAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGY7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNJbWFnZVNlcnZpY2VMYXllcicpIHtcclxuICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTSW1hZ2VTZXJ2aWNlTGF5ZXInKTtcclxuICAgIGx5ciA9IEwuZXNyaS5pbWFnZU1hcExheWVyKHtcclxuICAgICAgdXJsOiBsYXllci51cmxcclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0lNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTTWFwU2VydmljZUxheWVyJykge1xyXG4gICAgbHlyID0gTC5lc3JpLmR5bmFtaWNNYXBMYXllcih7XHJcbiAgICAgIHVybDogbGF5ZXIudXJsXHJcbiAgICB9KTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdETUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU1RpbGVkTWFwU2VydmljZUxheWVyJykge1xyXG4gICAgdHJ5IHtcclxuICAgICAgbHlyID0gTC5lc3JpLmJhc2VtYXBMYXllcihsYXllci50aXRsZSk7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIGx5ciA9IEwuZXNyaS50aWxlZE1hcExheWVyKHtcclxuICAgICAgICB1cmw6IGxheWVyLnVybFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIEwuZXNyaS5yZXF1ZXN0KGxheWVyLnVybCwge30sIGZ1bmN0aW9uIChlcnIsIHJlcykge1xyXG4gICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHZhciBtYXhXaWR0aCA9IChtYXAuZ2V0U2l6ZSgpLnggLSA1NSk7XHJcbiAgICAgICAgICB2YXIgdGlsZWRBdHRyaWJ1dGlvbiA9ICc8c3BhbiBjbGFzcz1cImVzcmktYXR0cmlidXRpb25zXCIgc3R5bGU9XCJsaW5lLWhlaWdodDoxNHB4OyB2ZXJ0aWNhbC1hbGlnbjogLTNweDsgdGV4dC1vdmVyZmxvdzplbGxpcHNpczsgd2hpdGUtc3BhY2U6bm93cmFwOyBvdmVyZmxvdzpoaWRkZW47IGRpc3BsYXk6aW5saW5lLWJsb2NrOyBtYXgtd2lkdGg6JyArIG1heFdpZHRoICsgJ3B4O1wiPicgKyByZXMuY29weXJpZ2h0VGV4dCArICc8L3NwYW4+JztcclxuICAgICAgICAgIG1hcC5hdHRyaWJ1dGlvbkNvbnRyb2wuYWRkQXR0cmlidXRpb24odGlsZWRBdHRyaWJ1dGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdUTUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ09wZW5TdHJlZXRNYXAnKSB7XHJcbiAgICBseXIgPSBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xyXG4gICAgICBhdHRyaWJ1dGlvbjogJyZjb3B5OyA8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T3BlblN0cmVldE1hcDwvYT4gY29udHJpYnV0b3JzJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ1dlYlRpbGVkTGF5ZXInKSB7XHJcbiAgICB2YXIgbHlyVXJsID0gX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldChsYXllci50ZW1wbGF0ZVVybCk7XHJcbiAgICBseXIgPSBMLnRpbGVMYXllcihseXJVcmwsIHtcclxuICAgICAgYXR0cmlidXRpb246IGxheWVyLmNvcHlyaWdodFxyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2Uge1xyXG4gICAgbHlyID0gTC5mZWF0dXJlR3JvdXAoW10pO1xyXG4gICAgY29uc29sZS5sb2coJ1Vuc3VwcG9ydGVkIExheWVyOiAnLCBsYXllcik7XHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXQgKHVybCkge1xyXG4gIHZhciBuZXdVcmwgPSB1cmw7XHJcblxyXG4gIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtsZXZlbH0vZywgJ3t6fScpO1xyXG4gIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtjb2x9L2csICd7eH0nKTtcclxuICBuZXdVcmwgPSBuZXdVcmwucmVwbGFjZSgvXFx7cm93fS9nLCAne3l9Jyk7XHJcblxyXG4gIHJldHVybiBuZXdVcmw7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgT3BlcmF0aW9uYWxMYXllciA9IHtcclxuICBvcGVyYXRpb25hbExheWVyOiBvcGVyYXRpb25hbExheWVyLFxyXG4gIF9nZW5lcmF0ZUVzcmlMYXllcjogX2dlbmVyYXRlRXNyaUxheWVyLFxyXG4gIF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXQ6IF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXRcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IE9wZXJhdGlvbmFsTGF5ZXI7XHJcbiIsIi8qXHJcbiAqIEwuZXNyaS5XZWJNYXBcclxuICogQSBsZWFmbGV0IHBsdWdpbiB0byBkaXNwbGF5IEFyY0dJUyBXZWIgTWFwLiBodHRwczovL2dpdGh1Yi5jb20veW51bm9rYXdhL0wuZXNyaS5XZWJNYXBcclxuICogKGMpIDIwMTYgWXVzdWtlIE51bm9rYXdhXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIGBgYGpzXHJcbiAqIHZhciB3ZWJtYXAgPSBMLndlYm1hcCgnMjJjNTA0ZDIyOWYxNGM3ODljNWI0OWViZmYzOGI5NDEnLCB7IG1hcDogTC5tYXAoJ21hcCcpIH0pO1xyXG4gKiBgYGBcclxuICovXHJcblxyXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi4vcGFja2FnZS5qc29uJztcclxuXHJcbmltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5pbXBvcnQgeyBvcGVyYXRpb25hbExheWVyIH0gZnJvbSAnLi9PcGVyYXRpb25hbExheWVyJztcclxuXHJcbmV4cG9ydCB2YXIgV2ViTWFwID0gTC5FdmVudGVkLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgLy8gTC5NYXBcclxuICAgIG1hcDoge30sXHJcbiAgICAvLyBhY2Nlc3MgdG9rZW4gZm9yIHNlY3VyZSBjb250ZW50cyBvbiBBcmNHSVMgT25saW5lXHJcbiAgICB0b2tlbjogbnVsbFxyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uICh3ZWJtYXBJZCwgb3B0aW9ucykge1xyXG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX21hcCA9IHRoaXMub3B0aW9ucy5tYXA7XHJcbiAgICB0aGlzLl90b2tlbiA9IHRoaXMub3B0aW9ucy50b2tlbjtcclxuICAgIHRoaXMuX3dlYm1hcElkID0gd2VibWFwSWQ7XHJcbiAgICB0aGlzLl9sb2FkZWQgPSBmYWxzZTtcclxuICAgIHRoaXMuX21ldGFkYXRhTG9hZGVkID0gZmFsc2U7XHJcblxyXG4gICAgdGhpcy5sYXllcnMgPSBbXTsgLy8gQ2hlY2sgdGhlIGxheWVyIHR5cGVzIGhlcmUgLT4gaHR0cHM6Ly9naXRodWIuY29tL3ludW5va2F3YS9MLmVzcmkuV2ViTWFwL3dpa2kvTGF5ZXItdHlwZXNcclxuICAgIHRoaXMudGl0bGUgPSAnJzsgLy8gV2ViIE1hcCBUaXRsZVxyXG4gICAgdGhpcy5ib29rbWFya3MgPSBbXTsgLy8gV2ViIE1hcCBCb29rbWFya3MgLT4gW3sgbmFtZTogJ0Jvb2ttYXJrIG5hbWUnLCBib3VuZHM6IDxMLmxhdExuZ0JvdW5kcz4gfV1cclxuICAgIHRoaXMucG9ydGFsSXRlbSA9IHt9OyAvLyBXZWIgTWFwIE1ldGFkYXRhXHJcblxyXG4gICAgdGhpcy5WRVJTSU9OID0gdmVyc2lvbjtcclxuXHJcbiAgICB0aGlzLl9sb2FkV2ViTWFwTWV0YURhdGEod2VibWFwSWQpO1xyXG4gICAgdGhpcy5fbG9hZFdlYk1hcCh3ZWJtYXBJZCk7XHJcbiAgfSxcclxuXHJcbiAgX2xvYWRXZWJNYXBNZXRhRGF0YTogZnVuY3Rpb24gKGlkKSB7XHJcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xyXG4gICAgdmFyIHdlYm1hcCA9IHRoaXM7XHJcbiAgICB2YXIgd2VibWFwTWV0YURhdGFSZXF1ZXN0VXJsID0gJ2h0dHBzOi8vd3d3LmFyY2dpcy5jb20vc2hhcmluZy9yZXN0L2NvbnRlbnQvaXRlbXMvJyArIGlkO1xyXG5cclxuICAgIEwuZXNyaS5yZXF1ZXN0KHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCwge30sIGZ1bmN0aW9uIChlcnJvciwgcmVzcG9uc2UpIHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdXZWJNYXAgTWV0YURhdGE6ICcsIHJlc3BvbnNlKTtcclxuICAgICAgICB3ZWJtYXAucG9ydGFsSXRlbSA9IHJlc3BvbnNlO1xyXG4gICAgICAgIHdlYm1hcC50aXRsZSA9IHJlc3BvbnNlLnRpdGxlO1xyXG4gICAgICAgIHdlYm1hcC5fbWV0YWRhdGFMb2FkZWQgPSB0cnVlO1xyXG4gICAgICAgIHdlYm1hcC5maXJlKCdtZXRhZGF0YUxvYWQnKTtcclxuICAgICAgICBtYXAuZml0Qm91bmRzKFtyZXNwb25zZS5leHRlbnRbMF0ucmV2ZXJzZSgpLCByZXNwb25zZS5leHRlbnRbMV0ucmV2ZXJzZSgpXSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH0sXHJcblxyXG4gIF9sb2FkV2ViTWFwOiBmdW5jdGlvbiAoaWQpIHtcclxuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XHJcbiAgICB2YXIgbGF5ZXJzID0gdGhpcy5sYXllcnM7XHJcbiAgICB2YXIgd2VibWFwUmVxdWVzdFVybCA9ICdodHRwczovL3d3dy5hcmNnaXMuY29tL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZCArICcvZGF0YSc7XHJcblxyXG4gICAgTC5lc3JpLnJlcXVlc3Qod2VibWFwUmVxdWVzdFVybCwge30sIGZ1bmN0aW9uIChlcnJvciwgcmVzcG9uc2UpIHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdXZWJNYXA6ICcsIHJlc3BvbnNlKTtcclxuXHJcbiAgICAgICAgLy8gQWRkIEJhc2VtYXBcclxuICAgICAgICByZXNwb25zZS5iYXNlTWFwLmJhc2VNYXBMYXllcnMubWFwKGZ1bmN0aW9uIChiYXNlTWFwTGF5ZXIpIHtcclxuICAgICAgICAgIHZhciBseXIgPSBvcGVyYXRpb25hbExheWVyKGJhc2VNYXBMYXllciwgbGF5ZXJzLCBtYXApLmFkZFRvKG1hcCk7XHJcbiAgICAgICAgICBpZiAobHlyICE9PSB1bmRlZmluZWQgJiYgYmFzZU1hcExheWVyLnZpc2liaWxpdHkgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgbHlyLmFkZFRvKG1hcCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBPcGVyYXRpb25hbCBMYXllcnNcclxuICAgICAgICByZXNwb25zZS5vcGVyYXRpb25hbExheWVycy5tYXAoZnVuY3Rpb24gKGxheWVyKSB7XHJcbiAgICAgICAgICB2YXIgbHlyID0gb3BlcmF0aW9uYWxMYXllcihsYXllciwgbGF5ZXJzLCBtYXApO1xyXG4gICAgICAgICAgaWYgKGx5ciAhPT0gdW5kZWZpbmVkICYmIGxheWVyLnZpc2liaWxpdHkgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgbHlyLmFkZFRvKG1hcCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBCb29rbWFya3NcclxuICAgICAgICBpZiAocmVzcG9uc2UuYm9va21hcmtzICE9PSB1bmRlZmluZWQgJiYgcmVzcG9uc2UuYm9va21hcmtzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHJlc3BvbnNlLmJvb2ttYXJrcy5tYXAoZnVuY3Rpb24gKGJvb2ttYXJrKSB7XHJcbiAgICAgICAgICAgIC8vIEVzcmkgRXh0ZW50IEdlb21ldHJ5IHRvIEwubGF0TG5nQm91bmRzXHJcbiAgICAgICAgICAgIHZhciBub3J0aEVhc3QgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoYm9va21hcmsuZXh0ZW50LnhtYXgsIGJvb2ttYXJrLmV4dGVudC55bWF4KSk7XHJcbiAgICAgICAgICAgIHZhciBzb3V0aFdlc3QgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoYm9va21hcmsuZXh0ZW50LnhtaW4sIGJvb2ttYXJrLmV4dGVudC55bWluKSk7XHJcbiAgICAgICAgICAgIHZhciBib3VuZHMgPSBMLmxhdExuZ0JvdW5kcyhzb3V0aFdlc3QsIG5vcnRoRWFzdCk7XHJcbiAgICAgICAgICAgIHRoaXMuYm9va21hcmtzLnB1c2goeyBuYW1lOiBib29rbWFyay5uYW1lLCBib3VuZHM6IGJvdW5kcyB9KTtcclxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9sb2FkZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xyXG4gICAgICB9XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd2ViTWFwICh3ZWJtYXBJZCwgb3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgV2ViTWFwKHdlYm1hcElkLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgd2ViTWFwO1xyXG4iXSwibmFtZXMiOltd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QUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQ3pELENBQUEsUUFBUSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDekQsQ0FBQSxRQUFRLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3JDLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSyxDQUFDLENBQUM7O0FBRVAsQ0FBQSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQ2xCLENBQUEsTUFBTSxjQUFjLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDdkMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDOztBQUV2QyxDQUFBLFFBQVEsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtBQUMzQixDQUFBLFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzFCLENBQUEsVUFBVSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxDQUFBLFNBQVM7O0FBRVQsQ0FBQSxRQUFRLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDdkUsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDL0QsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxD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