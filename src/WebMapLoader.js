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
        token: null
	},

	initialize: function(webmapId, options) {
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

	_loadWebMapMetaData: function(id) {
        //console.log(this);
        //console.log(this._token);
		var map = this._map;
		var webmap = this;
		var webmapMetaDataRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id;

		L.esri.request(webmapMetaDataRequestUrl, {}, function(error, response){
		  if(error){
		    console.log(error);
		  } else {
		    console.log('WebMap MetaData: ', response);
            //console.log('extent: ', response.extent);
            webmap.portalItem = response;
            webmap.title = response.title;
            webmap._metadataLoaded = true;
            webmap.fire('metadataLoad');
            map.fitBounds([response.extent[0].reverse(), response.extent[1].reverse()]);
		  }
		});
	},

	_loadWebMap: function(id) {
		var map = this._map;
        var layers = this.layers;
		var generateEsriLayer = this._generateEsriLayer;
		var webmapRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id + '/data';

		L.esri.request(webmapRequestUrl, {}, function(error, response){
		  if(error){
		    console.log(error);
		  } else {
		    console.log('WebMap: ', response);
				//console.log('baseMap: ', response.baseMap);
				//console.log('operationalLayers: ', response.operationalLayers);

				// Add Basemap
				response.baseMap.baseMapLayers.map(function(baseMapLayer) {
					var lyr = operationalLayer(baseMapLayer, layers, map).addTo(map);
                    if(lyr !== undefined && baseMapLayer.visibility === true) {
                        lyr.addTo(map);
                    }
				}.bind(this));

				// Add Operational Layers
				response.operationalLayers.map(function(layer) {
                    var lyr = operationalLayer(layer, layers, map);
                    if(lyr !== undefined && layer.visibility === true) {
                        lyr.addTo(map);
                    }
				}.bind(this));

                // Add Bookmarks
                if(response.bookmarks !== undefined && response.bookmarks.length > 0) {
                    response.bookmarks.map(function(bookmark) {
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