import L from 'leaflet';

import { arcgisToGeoJSON } from 'arcgis-to-geojson-utils';
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

export function featureCollection (geojson, options) {
  return new FeatureCollection(geojson, options);
}

export default featureCollection;
