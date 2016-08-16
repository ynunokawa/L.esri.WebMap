/*
 * L.esri.WebMap
 * A leaflet plugin to display ArcGIS Web Map. https://github.com/ynunokawa/L.esri.WebMap
 * (c) 2016 Yusuke Nunokawa
 *
 * @example
 *
 * ```js
 * var webmap = L.webmap('22c504d229f14c789c5b49ebff38b941', { map: L.map('map') });
 * ```
 */

import { version } from '../package.json';

import L from 'leaflet';
import { operationalLayer } from './OperationalLayer';

export var WebMap = L.Evented.extend({
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

export function webMap (webmapId, options) {
  return new WebMap(webmapId, options);
}

export default webMap;
