import L from 'leaflet';

import { classBreaksRenderer, uniqueValueRenderer, simpleRenderer } from 'esri-leaflet-renderers';

export var FeatureCollection = L.GeoJSON.extend({
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

export function featureCollection (geojson, options) {
  return new FeatureCollection(geojson, options);
}

export default featureCollection;
