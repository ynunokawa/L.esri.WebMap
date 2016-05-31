/*
 * L.esri.WebMap
 *
 *
 */

L.esri.WebMap = L.Class.extend({
	options: {
		map: {}
	},

	initialize: function(webmapId, options) {
		L.setOptions(this, options);

		this._map = this.options.map;
		this._webmapId = webmapId;
		this._mapOptions = {};
		this._baseMap = {};
		this._operationalLayers = {};
		this._exportOptions = {};
		this._layoutOptions = {};

		this._loadWebMapMetaData(webmapId);
		this._loadWebMap(webmapId);
	},

	_loadWebMapMetaData: function(id) {
		var map = this._map;
		var leafletLatlng = this.leafletLatlng;
		var webmapMetaDataRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id;
		L.esri.request(webmapMetaDataRequestUrl, {}, function(error, response){
		  if(error){
		    console.log(error);
		  } else {
		    console.log(response);
				console.log('extent: ', response.extent);

				map.fitBounds([leafletLatlng(response.extent[0]), leafletLatlng(response.extent[1])]);
		  }
		});
	},

	_loadWebMap: function(id) {
		var map = this._map;
		var generateEsriLayer = this.generateEsriLayer;
		//var basemapKey = this.getBasemapKey;
		var webmapRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id + '/data?f=json';
		L.esri.request(webmapRequestUrl, {}, function(error, response){
		  if(error){
		    console.log(error);
		  } else {
		    console.log(response);
				console.log('baseMap: ', response.baseMap);
				console.log('operationalLayers: ', response.operationalLayers);

				// Add Basemap
				response.baseMap.baseMapLayers.map(function(baseMapLayer) {
					generateEsriLayer(baseMapLayer).addTo(map);
				});
				/*L.esri.basemapLayer(basemapKey(response.baseMap.title)).addTo(map);
				if(response.baseMap.baseMapLayers.length == 2) {
					L.esri.basemapLayer(basemapKey(response.baseMap.title) + 'Labels').addTo(map);
				}*/

				// Add Operational Layers
				response.operationalLayers.map(function(layer) {
					console.log('operational layer: ', layer);
					if(layer.featureCollection === undefined) {
						console.log('It is not a feature collection');
						generateEsriLayer(layer).addTo(map);
					}
					else {
						//generateFeatureCollection();
					}
				});
		  }
		});
	},

	leafletLatlng: function(latlng) {
		var changedLatlng = [latlng[1], latlng[0]];
		return changedLatlng;
	},

	generateEsriLayer: function(layer) {
		var colorStopsToGradient = this.colorStopsToGradient;
		console.log('generateEsriLayer: ', layer);
		console.log(this.colorStopsToGradient);

		if(layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition.drawingInfo.renderer.type === 'heatmap') {
			console.log('create HeatmapLayer');
			var gradient = {};
			layer.layerDefinition.drawingInfo.renderer.colorStops.map(function(stop) {
				//gradient[stop.ratio] = 'rgba(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ',' + (stop.color[3]/255) + ')';
				gradient[Math.round(stop.ratio*100)/100] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
			});
			console.log(gradient);

			var layer = L.esri.Heat.heatmapFeatureLayer({
				url: layer.url,
				//blur: layer.layerDefinition.drawingInfo.renderer.blurRadius,
				//max: layer.layerDefinition.drawingInfo.renderer.maxPixelIntensity,
				gradient: gradient
			});
			return layer;
		}
		if(layer.layerType === 'ArcGISFeatureLayer') {
			console.log('create ArcGISFeatureLayer');
			var layer = L.esri.featureLayer({
		    url: layer.url
		  });
			return layer;
		}
		if(layer.layerType === 'ArcGISImageServiceLayer') {
			console.log('create ArcGISImageServiceLayer');
			var layer = L.esri.imageMapLayer({
				url: layer.url
			});
			return layer;
		}
		if(layer.layerType === 'ArcGISMapServiceLayer') {
			var layer = L.esri.dynamicMapLayer({
				url: layer.url
			});
			return layer;
		}
		if(layer.layerType === 'ArcGISTiledMapServiceLayer') {
			var layer = L.esri.tiledMapLayer({
				url: layer.url
			});
			return layer;
		}
		if(layer.layerType === '') {
			return false;
		}
		if(layer.layerType === '') {
			return false;
		}
	}

	/*getBasemapKey: function(title) {
		if(title === '') {
			return 'Streets';
		}
		if(title === 'Topographic') {
			return 'Topographic';
		}
		if(title === '') {
			return 'NationalGeographic';
		}
		if(title === '') {
			return 'Oceans';
		}
		if(title === 'Light Gray Canvas') {
			return 'Gray';
		}
		if(title === '') {
			return 'DarkGray';
		}
		if(title === '') {
			return 'Imagery';
		}
		if(title === '') {
			return 'ShadedRelief';
		}
		if(title === 'Terrain with Labels') {
			return 'Terrain';
		}
		if(title === '') {
			return 'USATopo';
		}
	}*/

});

/*L.esri.WebMap = function (options) {
	return new L.esri.WebMap(options);
};*/
