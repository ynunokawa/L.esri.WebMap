import L from 'leaflet';
import { _generateIcon } from '../OperationalLayer';
import { createPopupContent } from '../Popup/Popup';

export var FeatureCollection = L.FeatureGroup.extend({
  options: {
    data: {}, // Esri Feature Collection JSON
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

    this._perseFeatureCollection(this.data);
  },

  _perseFeatureCollection: function (data) {
    var features = data.layers[0].featureSet.features;
    var geometryType = data.layers[0].layerDefinition.geometryType; // 'esriGeometryPoint' | 'esriGeometryMultipoint' | 'esriGeometryPolyline' | 'esriGeometryPolygon' | 'esriGeometryEnvelope'
    var popupInfo = data.layers[0].popupInfo || null;
    var featuresArray = this._featureCollectionToFeaturesArray(features, geometryType, popupInfo);

    this._setFeatureCollection(featuresArray);
  },

  _featureCollectionToFeaturesArray: function (features, geometryType, popupInfo) {
    var featuresArray = [];
    var i, len;

    for (i = 0, len = features.length; i < len; i++) {
      var f;
      if (geometryType === 'esriGeometryPoint') {
        var icon = _generateIcon(this.renderer, features[i].attributes);
        var mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(features[i].geometry.x, features[i].geometry.y));
        f = L.marker(mercatorToLatlng, { icon: icon, opacity: this.opacity });
      } else if (geometryType === 'esriGeometryPoint') {

      } else if (geometryType === 'esriGeometryMultipoint') {

      } else if (geometryType === 'esriGeometryPolyline') {

      } else if (geometryType === 'esriGeometryPolygon') {

      } else if (geometryType === 'esriGeometryEnvelope') {

      }
      if (popupInfo !== null) {
        var popupContent = createPopupContent(popupInfo, features[i].attributes);
        f.bindPopup(popupContent);
      }
      featuresArray.push(f);
    }

    return featuresArray;
  },

  _setFeatureCollection: function (featuresArray) {
    var i, len;
    for (i = 0, len = featuresArray.length; i < len; i++) {
      this.addLayer(featuresArray[i]);
    }
  }
});

export function featureCollection (layers, options) {
  return new FeatureCollection(layers, options);
}

export default featureCollection;
