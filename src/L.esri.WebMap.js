/*
 * L.esri.WebMap
 * A leaflet plugin to display ArcGIS Web Map. https://github.com/ynunokawa/L.esri.WebMap
 * (c) 2016 Yusuke Nunokawa
 */

L.esri.WebMap = L.Evented.extend({
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
        this._loaded = false;

        this.layers = []; // Check the layer types here -> https://github.com/ynunokawa/L.esri.WebMap/wiki/Layer-types
        this.title = ''; // Web Map Title
        this.bookmarks = []; // Web Map Bookmarks -> [{ name: 'Bookmark name', bounds: <L.latLngBounds> }]
        this.portalItem = {}; // Web Map Metadata

		this._loadWebMapMetaData(webmapId);
		this._loadWebMap(webmapId);
	},

	_loadWebMapMetaData: function(id) {
        //console.log(this);
		var map = this._map;
		var leafletLatlng = this.leafletLatlng;
		var webmapMetaDataRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id;
		L.esri.request(webmapMetaDataRequestUrl, {}, function(error, response){
		  if(error){
		    console.log(error);
		  } else {
		    console.log('WebMap MetaData: ', response);
				//console.log('extent: ', response.extent);
                this.webmap.portalItem = response;
                this.webmap.title = response.title;
                this.webmap.fire('metadataLoad');
				map.fitBounds([leafletLatlng(response.extent[0]), leafletLatlng(response.extent[1])]);
		  }
		});
	},

	_loadWebMap: function(id) {
		var map = this._map;
		var generateEsriLayer = this._generateEsriLayer;
		//var basemapKey = this.getBasemapKey;
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
					var lyr = generateEsriLayer(baseMapLayer).addTo(map);
                    if(lyr !== undefined && baseMapLayer.visibility === true) {
                        lyr.addTo(map);
                    }
				});

				// Add Operational Layers
				response.operationalLayers.map(function(layer) {
                    var lyr = generateEsriLayer(layer);
                    if(lyr !== undefined && layer.visibility === true) {
                        lyr.addTo(map);
                    }
				});
                
                // Add Bookmarks
                if(response.bookmarks !== undefined && response.bookmarks.length > 0) {
                    response.bookmarks.map(function(bookmark) {
                        // Esri Extent Geometry to L.latLngBounds
                        var northEast = L.Projection.SphericalMercator.unproject(L.point(bookmark.extent.xmax, bookmark.extent.ymax));
                        var southWest = L.Projection.SphericalMercator.unproject(L.point(bookmark.extent.xmin, bookmark.extent.ymin));
                        var bounds = L.latLngBounds(southWest, northEast);
                        this.webmap.bookmarks.push({ name: bookmark.name, bounds: bounds });
                    });
                }
                
                this.webmap._loaded = true;
                this.webmap.fire('load');
		  }
		});
	},

	leafletLatlng: function(latlng) {
		var changedLatlng = [latlng[1], latlng[0]];
		return changedLatlng;
	},

    _createPopupContent: function(popupInfo, properties) {
        //console.log(popupInfo, properties);
        var r = /\{([^\]]*)\}/g;
        var titleText = '';
        if(popupInfo.title !== undefined) {
            titleText = popupInfo.title;
        }
        titleText = titleText.replace(r, function(s) {
            var m = r.exec(s);
            return properties[m[1]];
        });

        var content = '<div class="leaflet-popup-content-title"><h4>' + titleText + '</h4></div><div class="leaflet-popup-content-description">';
        if(popupInfo.fieldInfos.length > 0) {
            popupInfo.fieldInfos.map(function(info) {
                if(popupInfo.fieldInfos.length === i+1) {
                    content += '<div style="font-weight:bold;color:#999;margin-top:5px;">' + info.label + '</div> ' + properties[info.fieldName] + '</div>';
                }
                else {
                    content += '<div style="font-weight:bold;color:#999;margin-top:5px;">' + info.label + '</div> ' + properties[info.fieldName] + '<br>';
                }
            });
        }
        if(popupInfo.mediaInfos.length > 0) {

        }
        return content;
    },

    _pointSymbol: function(symbol) {
        var icon;
        if(symbol.type === 'esriPMS') {
            icon = L.icon({
                iconUrl: symbol.url,
                shadowUrl: '',
                iconSize:     [symbol.height, symbol.width],
                shadowSize:   [0, 0],
                iconAnchor:   [symbol.height-16, symbol.width-1],
                shadowAnchor: [0, 0],
                popupAnchor:  [symbol.width/3, symbol.height*-1]
            });
        }
        if(symbol.type === 'esriSMS') {
            if(symbol.style === 'esriSMSCircle') {
                if(symbol.outline.style === 'esriSLSNull') {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: (symbol.size/2 + symbol.outline.width) * 2,
                        svgWidth: (symbol.size/2 + symbol.outline.width) * 2,
                        type: 'circle',
                        shape: {
                            r: symbol.size/2 + '',
                            cx: symbol.size/2 + symbol.outline.width,
                            cy: symbol.size/2 + symbol.outline.width
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            //stroke: '',
                            strokeWidth: 0
                        }
                    });
                }
                else {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: (symbol.size/2 + symbol.outline.width) * 2,
                        svgWidth: (symbol.size/2 + symbol.outline.width) * 2,
                        type: 'circle',
                        shape: {
                            r: symbol.size/2 + '',
                            cx: symbol.size/2 + symbol.outline.width,
                            cy: symbol.size/2 + symbol.outline.width
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            stroke: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
                            strokeWidth: symbol.outline.width
                        }
                    });
                }
            }
            else if(symbol.style === 'esriSMSSquare') {
                if(symbol.outline.style === 'esriSLSNull') {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: symbol.size + symbol.outline.width * 2 + 2,
                        svgWidth: symbol.size + symbol.outline.width * 2 + 2,
                        type: 'rect',
                        shape: {
                            x: '1',
                            y: '1',
                            width: symbol.size + '',
                            height: symbol.size + ''
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            //stroke: '',
                            strokeWidth: 0
                        }
                    });
                }
                else {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: symbol.size + symbol.outline.width * 2 + 2,
                        svgWidth: symbol.size + symbol.outline.width * 2 + 2,
                        type: 'rect',
                        shape: {
                            x: '1',
                            y: '1',
                            width: symbol.size + '',
                            height: symbol.size + ''
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            stroke: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
                            strokeWidth: symbol.outline.width
                        }
                    });
                }
            }
            /*else if(symbol.style === 'esriSMSDiamond') {
                if(symbol.outline.style === 'esriSLSNull') {

                }
                else {

                }
            }*/
            else if(symbol.style === '') {
                if(symbol.outline.style === 'esriSLSNull') {

                }
                else {

                }
            }
            // Other SMSs -> Circle
            else {
                if(symbol.outline.style === 'esriSLSNull') {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: (symbol.size + symbol.outline.width) * 2,
                        svgWidth: (symbol.size + symbol.outline.width) * 2,
                        type: 'circle',
                        shape: {
                            r: symbol.size + '',
                            cx: symbol.size + symbol.outline.width,
                            cy: symbol.size + symbol.outline.width
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            //stroke: '',
                            strokeWidth: 0
                        }
                    });
                }
                else {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: (symbol.size + symbol.outline.width) * 2,
                        svgWidth: (symbol.size + symbol.outline.width) * 2,
                        type: 'circle',
                        shape: {
                            r: symbol.size + '',
                            cx: symbol.size + symbol.outline.width,
                            cy: symbol.size + symbol.outline.width
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            stroke: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
                            strokeWidth: symbol.outline.width
                        }
                    });
                }
            }
        }
        return icon;
    },

    _pathSymbol: function(symbol) {
        var style;
        if(symbol.style === 'esriSLSSolid') {
            style = {
                color: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                weight: symbol.size || symbol.width
            }
        }
        if(symbol.style === 'esriSFSSolid') {
            style = {
                fillColor: 'rgb(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ')',
                fillOpacity: symbol.color[3]/255,
                color: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
                weight: symbol.outline.width
            }
        }
        return style;
    },

    _calVisualVariables: function(symbol, visualVariables, properties) {
        var vvSymbol = symbol;
        //var value = properties[visualVariables[0].field];
        visualVariables.map(function (vv) {
            var value = properties[vv.field];
            if(vv.type === 'sizeInfo') {
                var rate = (value - vv.minDataValue)/(vv.maxDataValue - vv.minDataValue);
                var submitSize = (rate * (vv.maxSize - vv.minSize)) + vv.minSize;
                vvSymbol.size = submitSize;
                if(value === null) {
                    vvSymbol.size = 6;
                }
            }
            else if(vv.type === 'colorInfo') {
                // Color Ramp
                //console.log(symbol.color);
                var stops = vv.stops;
                //console.log(vv.stops);
                stops.map(function(stop, i) {
                    //console.log('base color: ', stop.color);
                    if(i === 0) {
                        if(stop.value > value) {
                            var submitColor = stop.color;
                            vvSymbol.color = submitColor;
                            //console.log('min: ', vvSymbol.color);
                        }
                    }
                    else if(i === stops.length-1) {
                        if(stop.value <= value) {
                            var submitColor = stop.color;
                            vvSymbol.color = submitColor;
                            //console.log('max: ', vvSymbol.color);
                        }
                    }
                    else {
                        if(stop.value > value && stops[i-1].value <= value) {
                            var submitColor = [];
                            var rate = (value - stops[i-1].value)/(stop.value - stops[i-1].value);
                            vvSymbol.color.map(function(color, j) {
                                submitColor[j] = Math.round((rate * (stop.color[j] - stops[i-1].color[j])) + stops[i-1].color[j]);
                            });
                            vvSymbol.color = submitColor;
                            //console.log(vvSymbol.color);
                        }
                    }
                });
            }
        });
        return vvSymbol;
    },

    _generatePathStyle: function(renderer, properties) {
        var style = {};
        if(renderer.type === 'simple') {
            style = this._pathSymbol(renderer.symbol);
        }
        if(renderer.type === 'uniqueValue') {
            renderer.uniqueValueInfos.map(function(info) {
                if(info.value === properties[renderer.field1]) { // field2, field3は後で考えよう
                    var symbol = info.symbol;
                    if(renderer.visualVariables !== undefined) {
                        symbol = this.webmap._calVisualVariables(info.symbol, renderer.visualVariables, properties);
                    }
                    style = this.webmap._pathSymbol(symbol);
                }
            });
        }
        if(renderer.type === 'classBreaks') {
            renderer.classBreakInfos.map(function(info, i) {
                var prevInfo;
                var symbol = info.symbol;
                if(i === 0) {
                    prevInfo = renderer.minValue;
                }
                else {
                    prevInfo = renderer.classBreakInfos[i-1].classMaxValue;
                }
                //console.log(info.classMaxValue, properties[renderer.field], prevInfo);
                if(renderer.classBreakInfos.length === (i+1)) {
                    if(info.classMaxValue >= properties[renderer.field] && prevInfo <= properties[renderer.field]) {
                        if(renderer.visualVariables !== undefined) {
                            symbol = this.webmap._calVisualVariables(info.symbol, renderer.visualVariables, properties);
                        }
                        style = this.webmap._pathSymbol(info.symbol);
                    }
                }
                else {
                    if(info.classMaxValue > properties[renderer.field] && prevInfo <= properties[renderer.field]) {
                        if(renderer.visualVariables !== undefined) {
                            symbol = this.webmap._calVisualVariables(info.symbol, renderer.visualVariables, properties);
                        }
                        style = this.webmap._pathSymbol(info.symbol);
                    }
                }
            });
        }
        return style;
    },

    _generateIcon: function(renderer, properties) {
        //console.log(renderer);
        var icon;
        if(renderer.type === 'simple') {
            icon = this._pointSymbol(renderer.symbol);
        }
        if(renderer.type === 'uniqueValue') {
            renderer.uniqueValueInfos.map(function(info) {
                if(info.value === properties[renderer.field1]) { // field2, field3は後で考えよう
                    var symbol = info.symbol;
                    if(renderer.visualVariables !== undefined) {
                        symbol = this.webmap._calVisualVariables(info.symbol, renderer.visualVariables, properties);
                    }
                    console.log(symbol);
                    icon = this.webmap._pointSymbol(symbol);
                }
            });
        }
        if(renderer.type === 'classBreaks') {
            renderer.classBreakInfos.map(function(info, i) {
                var prevInfo;
                var symbol = info.symbol;
                if(i === 0) {
                    prevInfo = renderer.minValue;
                }
                else {
                    prevInfo = renderer.classBreakInfos[i-1].classMaxValue;
                }
                //console.log(info.classMaxValue, properties[renderer.field], prevInfo);
                if(renderer.classBreakInfos.length === (i+1)) {
                    if(info.classMaxValue >= properties[renderer.field] && prevInfo <= properties[renderer.field]) {
                        if(renderer.visualVariables !== undefined) {
                            symbol = this.webmap._calVisualVariables(info.symbol, renderer.visualVariables, properties);
                        }
                        icon = this.webmap._pointSymbol(symbol);
                    }
                }
                else {
                    if(info.classMaxValue > properties[renderer.field] && prevInfo <= properties[renderer.field]) {
                        if(renderer.visualVariables !== undefined) {
                            symbol = this.webmap._calVisualVariables(info.symbol, renderer.visualVariables, properties);
                        }
                        icon = this.webmap._pointSymbol(info.symbol);
                    }
                }
            });
        }
        return icon;
    },

    _generateLabel: function(properties, labelingInfo) {
        //console.log('generateLabels: ', properties, labelingInfo);
        var r = /\[([^\]]*)\]/g;
        var labelText = labelingInfo[0].labelExpression;
        labelText = labelText.replace(r, function(s) {
            var m = r.exec(s);
            //console.log(m[1]);
            //console.log(properties[m[1]]);
            return properties[m[1]];
        });
        return labelText;
    },

	_generateEsriLayer: function(layer) {
		console.log('generateEsriLayer: ', layer.title, layer);

		//console.log(this.webmap);

		if(layer.featureCollection !== undefined) {
            // Supporting only point geometry
            console.log('create FeatureCollection');
            var renderer = layer.featureCollection.layers[0].layerDefinition.drawingInfo.renderer;
            //console.log(renderer);
            var features = [];
            var labels = [];
            layer.featureCollection.layers[0].featureSet.features.map(function(feature) {

                var icon = this.webmap._generateIcon(renderer, feature.attributes);
                var mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(feature.geometry.x, feature.geometry.y));

                var f = L.marker(mercatorToLatlng, { icon: icon, opacity: layer.opacity });

                if(layer.featureCollection.layers[0].popupInfo !== undefined) {
                    var popupContent = this.webmap._createPopupContent(layer.featureCollection.layers[0].popupInfo, feature.attributes);
                    f.bindPopup(popupContent);
                }

                if(layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo !== undefined) {
                    var labelingInfo = layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo;
                    var labelText = this.webmap._generateLabel(feature.attributes, labelingInfo);
										// with Leaflet.label
										//f.bindLabel(labelText, { noHide: true }).showLabel();

										// without Leaflet.label
										var label = L.marker(mercatorToLatlng, {
											zIndexOffset: 1,
								      icon: L.divIcon({
								        iconSize: null,
								        className: 'point-label',
								        html: '<div>' + labelText + '</div>'
								      })
								    });
                                    
                                    labels.push(label);
                }

                features.push(f);
            });

            var lyr = L.featureGroup(features);
            if(labels.length > 0) {
                var labelsLayer = L.featureGroup(labels);
                lyr = L.layerGroup([lyr, labelsLayer]);
            }
            this.webmap.layers.push({ type: 'FC', title: layer.title || '', layer: lyr });
            return lyr;
        }
		if(layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition !== undefined) {
            if(layer.layerDefinition.drawingInfo !== undefined){
                if(layer.layerDefinition.drawingInfo.renderer.type === 'heatmap'){
                    console.log('create HeatmapLayer');
                    var gradient = {};
                    layer.layerDefinition.drawingInfo.renderer.colorStops.map(function(stop) {
                        //gradient[stop.ratio] = 'rgba(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ',' + (stop.color[3]/255) + ')';
                        //gradient[Math.round(stop.ratio*100)/100] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
                        gradient[(Math.round(stop.ratio*100)/100+6)/7] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
                    });
                    //console.log(layer.layerDefinition.drawingInfo.renderer);

                    var lyr = L.esri.Heat.heatmapFeatureLayer({ // Esri Leaflet 2.0
                    //var lyr = L.esri.heatmapFeatureLayer({ // Esri Leaflet 1.0
                        url: layer.url,
                        minOpacity: 0.5,
                        max: layer.layerDefinition.drawingInfo.renderer.maxPixelIntensity,
                        blur: layer.layerDefinition.drawingInfo.renderer.blurRadius,
                        radius: layer.layerDefinition.drawingInfo.renderer.blurRadius * 1.3,
                        gradient: gradient
                    })
                    this.webmap.layers.push({ type: 'HL', title: layer.title || '', layer: lyr });
                    return lyr;
                }
                else {
                    console.log('create ArcGISFeatureLayer (with layerDefinition.drawingInfo)');
                    var renderer = layer.layerDefinition.drawingInfo.renderer;
                    var where = '1=1';
                    if(layer.layerDefinition.definitionExpression !== undefined) {
                        where = layer.layerDefinition.definitionExpression;
                    }

                    var labels = [];
                    var labelsLayer = L.featureGroup(labels);
                    var lyr = L.esri.featureLayer({
                        url: layer.url,
                        where: where,
                        pointToLayer: function (geojson, latlng) {
                            //console.log(geojson);
                            //var popupContent = this.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                            var icon = this.webmap._generateIcon(renderer, geojson.properties);

                            var f = L.marker(latlng, {
                                icon: icon,
                                opacity: layer.opacity
                            });

                            return f;
                        },
                        style: function (geojson) {
                            var pathOptions;
                            //console.log(geojson);
                            if(geojson.geometry.type === 'LineString' || geojson.geometry.type === 'MultiLineString' || geojson.geometry.type === 'Polygon' || geojson.geometry.type === 'MultiPolygon') {
                                pathOptions = this.webmap._generatePathStyle(renderer, geojson.properties);
                            }
                            else {
                                //console.log(geojson);
                            }

                            return pathOptions;
                        },
                        onEachFeature: function (geojson, l) {
                            if(layer.popupInfo !== undefined) {
                                var popupContent = window.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                                l.bindPopup(popupContent);
                            }
                            if(layer.layerDefinition.drawingInfo.labelingInfo !== undefined) {
                                var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
                                var labelText = window.webmap._generateLabel(geojson.properties, labelingInfo);
                                console.log(labelText);
																// with Leaflet.label
																//f.bindLabel(labelText, { noHide: true }).showLabel();

																console.log(geojson);
																console.log(l);
																var labelPos;
																var labelClassName;
																if(l.feature.geometry.type === 'Point') {
																	labelPos = l.feature.geometry.coordinates;
																	labelClassName = 'point-label';
																}
                                                                else if(l.feature.geometry.type === 'LineString') {
                                                                    console.log(l.feature.geometry.coordinates);
                                                                    var c = l.feature.geometry.coordinates;
                                                                    var centralKey = Math.round(c.length/2);
                                                                    console.log(c[centralKey]);
                                                                    labelPos = c[centralKey].reverse();
                                                                    labelClassName = 'path-label';
                                                                }
                                                                else if(l.feature.geometry.type === 'MultiLineString') {
                                                                    console.log(l.feature.geometry.coordinates);
                                                                    var c = l.feature.geometry.coordinates;
                                                                    var centralKey = Math.round(c.length/2);
                                                                    var c2 = c[centralKey];
                                                                    var centralKey = Math.round(c2.length/2);
                                                                    console.log(c2[centralKey]);
                                                                    labelPos = c2[centralKey].reverse();
                                                                    labelClassName = 'path-label';
                                                                }
																else {
																	labelPos = l.getBounds().getCenter();
                                                                    console.log(labelPos);
																	labelClassName = 'path-label';
																}
																// without Leaflet.label
																var label = L.marker(labelPos, {
                                                                    zIndexOffset: 1,
                                                                    icon: L.divIcon({
                                                                        iconSize: null,
                                                                        className: labelClassName,
                                                                        html: '<div>' + labelText + '</div>'
                                                                    })
                                                                });
                                                                
                                                                labelsLayer.addLayer(label);
                            }
                        }
                    });
                    
                    lyr = L.layerGroup([lyr, labelsLayer]);
                    
                    this.webmap.layers.push({ type: 'FL', title: layer.title || '', layer: lyr });
                    return lyr;
                }
            }
            else {
                console.log('create ArcGISFeatureLayer (without layerDefinition.drawingInfo)');
                var where = '1=1';
                if(layer.layerDefinition.definitionExpression !== undefined) {
                    where = layer.layerDefinition.definitionExpression;
                }

                var lyr = L.esri.featureLayer({
                    url: layer.url,
                    where: where,
                    onEachFeature: function (geojson, l) {
                        if(layer.popupInfo !== undefined) {
                            var popupContent = window.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                            l.bindPopup(popupContent);
                        }
                    }
                });
                this.webmap.layers.push({ type: 'FL', title: layer.title || '', layer: lyr });
                return lyr;
            }
		}
		if(layer.layerType === 'ArcGISFeatureLayer') {
			console.log('create ArcGISFeatureLayer');
            var lyr = L.esri.featureLayer({
                url: layer.url,
                pointToLayer: function (geojson, latlng) {

                    //var popupContent = this.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                    //var icon = this.webmap._generateIcon(renderer, geojson.properties);

                    var f = L.marker(latlng, {
                        //icon: icon,
                        opacity: layer.opacity
                    });

                    if(layer.popupInfo !== undefined) {
                        var popupContent = window.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                        f.bindPopup(popupContent);
                    }

                    return f;
                }
            });
            this.webmap.layers.push({ type: 'FL', title: layer.title || '', layer: lyr });
			return lyr;
		}
		if(layer.layerType === 'ArcGISImageServiceLayer') {
			console.log('create ArcGISImageServiceLayer');
			var lyr = L.esri.imageMapLayer({
				url: layer.url
			});
            this.webmap.layers.push({ type: 'IML', title: layer.title || '', layer: lyr });
			return lyr;
		}
		if(layer.layerType === 'ArcGISMapServiceLayer') {
			var lyr = L.esri.dynamicMapLayer({
				url: layer.url
			});
            this.webmap.layers.push({ type: 'DML', title: layer.title || '', layer: lyr });
			return lyr;
		}
		if(layer.layerType === 'ArcGISTiledMapServiceLayer') {
			var lyr = L.esri.tiledMapLayer({
				url: layer.url
			});
            this.webmap.layers.push({ type: 'TML', title: layer.title || '', layer: lyr });
			return lyr;
		}
		if(layer.layerType === '') {
			return false;
		}
		if(layer.layerType === '') {
			return false;
		}
	}

});

L.esri.webMap = function (webmapId, options) {
	return new L.esri.WebMap(webmapId, options);
};
