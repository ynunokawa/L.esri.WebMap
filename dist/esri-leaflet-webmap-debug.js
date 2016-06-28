/* esri-leaflet-webmap - v0.2.3 - Tue Jun 28 2016 16:05:31 GMT+0900 (東京 (標準時))
 * Copyright (c) 2016 Yusuke Nunokawa <nuno0825@gmail.com>
 * MIT */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet')) :
	typeof define === 'function' && define.amd ? define(['exports', 'leaflet'], factory) :
	(factory((global.L = global.L || {}, global.L.esri = global.L.esri || {}),global.L));
}(this, function (exports,L) { 'use strict';

	L = 'default' in L ? L['default'] : L;

	var version = "0.2.3";

	function createPopupContent (popupInfo, properties) {
	    //console.log(popupInfo, properties);
	    var r = /\{([^\]]*)\}/g;
	    var titleText = '';
	    var content = '';

	    if (popupInfo.title !== undefined) {
	        titleText = popupInfo.title;
	    }

	    titleText = titleText.replace(r, function(s) {
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

	function createLabelText (properties, labelingInfo) {
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
	}

	function operationalLayer (layer, layers, map) {
	  return _generateEsriLayer(layer, layers, map);
	}

	function _generateEsriLayer (layer, layers, map) {
	    console.log('generateEsriLayer: ', layer.title, layer);

	    if(layer.featureCollection !== undefined) {
	        // Supporting only point geometry
	        console.log('create FeatureCollection');
	        var renderer = layer.featureCollection.layers[0].layerDefinition.drawingInfo.renderer;
	        //console.log(renderer);
	        var features = [];
	        var labels = [];

	        layer.featureCollection.layers[0].featureSet.features.map(function(feature) {

	            var icon = _generateIcon(renderer, feature.attributes);
	            var mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(feature.geometry.x, feature.geometry.y));

	            var f = L.marker(mercatorToLatlng, { icon: icon, opacity: layer.opacity });

	            if(layer.featureCollection.layers[0].popupInfo !== undefined) {
	                var popupContent = createPopupContent(layer.featureCollection.layers[0].popupInfo, feature.attributes);
	                f.bindPopup(popupContent);
	            }

	            if(layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo !== undefined) {
	                var labelingInfo = layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo;
	                var labelText = createLabelText(feature.attributes, labelingInfo);
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

	        layers.push({ type: 'FC', title: layer.title || '', layer: lyr });

	        return lyr;
	    }
	    else if(layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition !== undefined) {
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
	                layers.push({ type: 'HL', title: layer.title || '', layer: lyr });

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
	                    ignoreRenderer: true,
	                    pointToLayer: function (geojson, latlng) {
	                        //console.log(geojson);
	                        var icon = _generateIcon(renderer, geojson.properties);

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
	                            pathOptions = _generatePathStyle(renderer, geojson.properties);
	                        }
	                        else {
	                            //console.log(geojson);
	                        }

	                        return pathOptions;
	                    },
	                    onEachFeature: function (geojson, l) {
	                        if(layer.popupInfo !== undefined) {
	                            var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	                            l.bindPopup(popupContent);
	                        }
	                        if(layer.layerDefinition.drawingInfo.labelingInfo !== undefined) {
	                            var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
	                            var labelText = createLabelText(geojson.properties, labelingInfo);
	                            //console.log(labelText);
	                            // with Leaflet.label
	                            //f.bindLabel(labelText, { noHide: true }).showLabel();

	                            //console.log(geojson);
	                            //console.log(l);
	                            var labelPos;
	                            var labelClassName;
	                            if(l.feature.geometry.type === 'Point') {
	                                labelPos = l.feature.geometry.coordinates.reverse();
	                                labelClassName = 'point-label';
	                            }
	                            else if(l.feature.geometry.type === 'LineString') {
	                                //console.log(l.feature.geometry.coordinates);
	                                var c = l.feature.geometry.coordinates;
	                                var centralKey = Math.round(c.length/2);
	                                //console.log(c[centralKey]);
	                                labelPos = c[centralKey].reverse();
	                                labelClassName = 'path-label';
	                            }
	                            else if(l.feature.geometry.type === 'MultiLineString') {
	                                //.log(l.feature.geometry.coordinates);
	                                var c = l.feature.geometry.coordinates;
	                                var centralKey = Math.round(c.length/2);
	                                var c2 = c[centralKey];
	                                var centralKey = Math.round(c2.length/2);
	                                //console.log(c2[centralKey]);
	                                labelPos = c2[centralKey].reverse();
	                                labelClassName = 'path-label';
	                            }
	                            else {
	                                labelPos = l.getBounds().getCenter();
	                                //console.log(labelPos);
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

	                layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

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
	                        var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	                        l.bindPopup(popupContent);
	                    }
	                }
	            });

	            /*lyr.metadata(function(error, response) {
	                console.log(error, response);
	            }, function(error) { console.log(error); });*/

	            layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	            return lyr;
	        }
	    }
	    else if(layer.layerType === 'ArcGISFeatureLayer') {
	        console.log('create ArcGISFeatureLayer');
	        var lyr = L.esri.featureLayer({
	            url: layer.url,
	            onEachFeature: function (geojson, l) {
	                if(layer.popupInfo !== undefined) {
	                    var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	                    l.bindPopup(popupContent);
	                }
	            },
	            pointToLayer: function (geojson, latlng) {

	                var f = L.marker(latlng, {
	                    //icon: icon,
	                    opacity: layer.opacity
	                });

	                return f;
	            }
	        });

	        /*lyr.metadata(function(error, response) {
	            console.log(error, response);
	        }, function(error) { console.log(error); });*/

	        layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	        return lyr;
	    }
	    else if(layer.layerType === 'ArcGISImageServiceLayer') {
	        console.log('create ArcGISImageServiceLayer');
	        var lyr = L.esri.imageMapLayer({
	            url: layer.url
	        });

	        layers.push({ type: 'IML', title: layer.title || '', layer: lyr });

	        return lyr;
	    }
	    else if(layer.layerType === 'ArcGISMapServiceLayer') {
	        var lyr = L.esri.dynamicMapLayer({
	            url: layer.url
	        });

	        layers.push({ type: 'DML', title: layer.title || '', layer: lyr });

	        return lyr;
	    }
	    else if(layer.layerType === 'ArcGISTiledMapServiceLayer') {
	    try {
	    var lyr = L.esri.basemapLayer(layer.title);
	    }
	    catch (e) {
	    var lyr = L.esri.tiledMapLayer({
	            url: layer.url
	        });

	    L.esri.request(layer.url, {}, function (err, res) {
	        var maxWidth = (map.getSize().x - 55);
	        var tiledAttribution = '<span class="esri-attributions" style="line-height:14px; vertical-align: -3px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; display:inline-block; max-width:' + maxWidth + 'px;">' + res.copyrightText + '</span>'
	        map.attributionControl.addAttribution(tiledAttribution);
	    });
	    }

	    layers.push({ type: 'TML', title: layer.title || '', layer: lyr });
	    return lyr;

	    }
	    else if(layer.layerType === 'OpenStreetMap') {
	        var lyr = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
	            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
	        });

	        layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

	        return lyr;
	    }
	    else if(layer.layerType === 'WebTiledLayer') {
	        var lyrUrl = _esriWTLUrlTemplateToLeaflet(layer.templateUrl);
	        var lyr = L.tileLayer(lyrUrl, {
	            attribution: layer.copyright
	        });

	        layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

	        return lyr;
	    }
	    else if(layer.layerType === '') {
	        return false;
	    }
	    else {
	        var lyr = L.featureGroup([]);
	        console.log('Unsupported Layer: ', layer);
	        return lyr;
	    }
	}


	// i will duplicate the below functions
	// and replace esri-leaflet-renderers.
	function _pointSymbol (symbol) {
	    var icon;

	        if(symbol.type === 'esriPMS') {
	            var iconUrl = symbol.url;

	            if(symbol.imageData !== undefined) {
	                iconUrl = 'data:' + symbol.contentType + ';base64,' + symbol.imageData;
	            }

	            icon = L.icon({
	                iconUrl: iconUrl,
	                shadowUrl: '',
	                iconSize:     [(symbol.height*4/3), (symbol.width*4/3)],
	                shadowSize:   [0, 0],
	                iconAnchor:   [(symbol.height*4/3)-16, (symbol.width*4/3)-1],
	                shadowAnchor: [0, 0],
	                popupAnchor:  [(symbol.width*4/3)/3, (symbol.height*4/3)*-1]
	            });
	        }
	        if(symbol.type === 'esriSMS') {
	            if(symbol.style === 'esriSMSCircle') {
	                if(symbol.outline.style === 'esriSLSNull') {
	                    icon = L.vectorIcon({
	                        //className: 'my-vector-icon',
	                        svgHeight: ((symbol.size*4/3)/2 + (symbol.outline.width*4/3)) * 2,
	                        svgWidth: ((symbol.size*4/3)/2 + (symbol.outline.width*4/3)) * 2,
	                        type: 'circle',
	                        shape: {
	                            r: (symbol.size*4/3)/2 + '',
	                            cx: (symbol.size*4/3)/2 + (symbol.outline.width*4/3),
	                            cy: (symbol.size*4/3)/2 + (symbol.outline.width*4/3)
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
	                        svgHeight: ((symbol.size*4/3)/2 + (symbol.outline.width*4/3)) * 2,
	                        svgWidth: ((symbol.size*4/3)/2 + (symbol.outline.width*4/3)) * 2,
	                        type: 'circle',
	                        shape: {
	                            r: (symbol.size*4/3)/2 + '',
	                            cx: (symbol.size*4/3)/2 + (symbol.outline.width*4/3),
	                            cy: (symbol.size*4/3)/2 + (symbol.outline.width*4/3)
	                        },
	                        style: {
	                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
	                            stroke: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
	                            strokeWidth: (symbol.outline.width*4/3)
	                        }
	                    });
	                }
	            }
	            else if(symbol.style === 'esriSMSSquare') {
	                if(symbol.outline.style === 'esriSLSNull') {
	                    icon = L.vectorIcon({
	                        //className: 'my-vector-icon',
	                        svgHeight: (symbol.size*4/3) + (symbol.outline.width*4/3) * 2 + 2,
	                        svgWidth: (symbol.size*4/3) + (symbol.outline.width*4/3) * 2 + 2,
	                        type: 'rect',
	                        shape: {
	                            x: '1',
	                            y: '1',
	                            width: (symbol.size*4/3) + '',
	                            height: (symbol.size*4/3) + ''
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
	                        svgHeight: (symbol.size*4/3) + (symbol.outline.width*4/3) * 2 + 2,
	                        svgWidth: (symbol.size*4/3) + (symbol.outline.width*4/3) * 2 + 2,
	                        type: 'rect',
	                        shape: {
	                            x: '1',
	                            y: '1',
	                            width: (symbol.size*4/3) + '',
	                            height: (symbol.size*4/3) + ''
	                        },
	                        style: {
	                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
	                            stroke: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
	                            strokeWidth: (symbol.outline.width*4/3)
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
	                        svgHeight: ((symbol.size*4/3) + (symbol.outline.width*4/3)) * 2,
	                        svgWidth: ((symbol.size*4/3) + (symbol.outline.width*4/3)) * 2,
	                        type: 'circle',
	                        shape: {
	                            r: (symbol.size*4/3) + '',
	                            cx: (symbol.size*4/3) + (symbol.outline.width*4/3),
	                            cy: (symbol.size*4/3) + (symbol.outline.width*4/3)
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
	                        svgHeight: ((symbol.size*4/3) + (symbol.outline.width*4/3)) * 2,
	                        svgWidth: ((symbol.size*4/3) + (symbol.outline.width*4/3)) * 2,
	                        type: 'circle',
	                        shape: {
	                            r: (symbol.size*4/3) + '',
	                            cx: (symbol.size*4/3) + (symbol.outline.width*4/3),
	                            cy: (symbol.size*4/3) + (symbol.outline.width*4/3)
	                        },
	                        style: {
	                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
	                            stroke: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
	                            strokeWidth: (symbol.outline.width*4/3)
	                        }
	                    });
	                }
	            }
	        }

	        return icon;
	}

	function _pathSymbol (symbol) {
	    var style;

	    if(symbol.style === 'esriSLSSolid') {
	        style = {
	            color: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
	            weight: (symbol.size*4/3) || (symbol.width*4/3)
	        }
	    }

	    if(symbol.style === 'esriSFSSolid') {
	        var color = symbol.color
	        var outlineColor = symbol.outline.color;

	        if(symbol.color === null) {
	            color = [0,0,0,0];
	        }

	        if(symbol.outline.color === null) {
	            outlineColor = [0,0,0,0];
	        }

	        style = {
	            fillColor: 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')',
	            fillOpacity: color[3]/255,
	            color: 'rgba(' + outlineColor[0] + ',' + outlineColor[1] + ',' + outlineColor[2] + ',' + outlineColor[3]/255 + ')',
	            weight: (symbol.outline.width*4/3)
	        }
	    }

	    return style;
	}

	function _calVisualVariables (symbol, visualVariables, properties) {
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
	}

	function _generatePathStyle (renderer, properties) {
	    var style = {};

	    if(renderer.type === 'simple') {
	        style = _pathSymbol(renderer.symbol);
	    }

	    if(renderer.type === 'uniqueValue') {
	        renderer.uniqueValueInfos.map(function(info) {
	            if(info.value === properties[renderer.field1]) { // field2, field3は後で考えよう
	                var symbol = info.symbol;
	                if(renderer.visualVariables !== undefined) {
	                    symbol = _calVisualVariables(info.symbol, renderer.visualVariables, properties);
	                }
	                style = _pathSymbol(symbol);
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
	                        symbol = _calVisualVariables(info.symbol, renderer.visualVariables, properties);
	                    }
	                    style = _pathSymbol(info.symbol);
	                }
	            }
	            else {
	                if(info.classMaxValue > properties[renderer.field] && prevInfo <= properties[renderer.field]) {
	                    if(renderer.visualVariables !== undefined) {
	                        symbol = _calVisualVariables(info.symbol, renderer.visualVariables, properties);
	                    }
	                    style = _pathSymbol(info.symbol);
	                }
	            }
	        });
	    }

	    return style;
	}

	function _generateIcon (renderer, properties) {
	    //console.log(renderer);
	    var icon;

	    if(renderer.type === 'simple') {
	        icon = _pointSymbol(renderer.symbol);
	    }

	    if(renderer.type === 'uniqueValue') {
	        renderer.uniqueValueInfos.map(function(info) {
	            if(info.value === properties[renderer.field1]) { // field2, field3は後で考えよう
	                var symbol = info.symbol;
	                if(renderer.visualVariables !== undefined) {
	                    symbol = _calVisualVariables(info.symbol, renderer.visualVariables, properties);
	                }
	                //console.log(symbol);
	                icon = _pointSymbol(symbol);
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
	                        symbol = _calVisualVariables(info.symbol, renderer.visualVariables, properties);
	                    }
	                    icon = _pointSymbol(symbol);
	                }
	            }
	            else {
	                if(info.classMaxValue > properties[renderer.field] && prevInfo <= properties[renderer.field]) {
	                    if(renderer.visualVariables !== undefined) {
	                        symbol = _calVisualVariables(info.symbol, renderer.visualVariables, properties);
	                    }
	                    icon = _pointSymbol(info.symbol);
	                }
	            }
	        });
	    }

	    return icon;
	}

	function _esriWTLUrlTemplateToLeaflet (url) {
	    var r = /\{([^\]]*)\}/g;
	    var newUrl = url;

	    newUrl = newUrl.replace(/\{level}/g, '{z}');
	    newUrl = newUrl.replace(/\{col}/g, '{x}');
	    newUrl = newUrl.replace(/\{row}/g, '{y}');
	    //console.log(newUrl);

	    return newUrl;
	}

	var WebMap = L.Evented.extend({
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

	function webMap (webmapId, options) {
	  return new WebMap(webmapId, options);
	}

	exports.WebMap = WebMap;
	exports.webMap = webMap;
	exports.operationalLayer = operationalLayer;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9Qb3B1cC9Qb3B1cC5qcyIsIi4uL3NyYy9MYWJlbC9MYWJlbC5qcyIsIi4uL3NyYy9PcGVyYXRpb25hbExheWVyLmpzIiwiLi4vc3JjL1dlYk1hcExvYWRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gY3JlYXRlUG9wdXBDb250ZW50IChwb3B1cEluZm8sIHByb3BlcnRpZXMpIHtcclxuICAgIC8vY29uc29sZS5sb2cocG9wdXBJbmZvLCBwcm9wZXJ0aWVzKTtcclxuICAgIHZhciByID0gL1xceyhbXlxcXV0qKVxcfS9nO1xyXG4gICAgdmFyIHRpdGxlVGV4dCA9ICcnO1xyXG4gICAgdmFyIGNvbnRlbnQgPSAnJztcclxuXHJcbiAgICBpZiAocG9wdXBJbmZvLnRpdGxlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICB0aXRsZVRleHQgPSBwb3B1cEluZm8udGl0bGU7XHJcbiAgICB9XHJcblxyXG4gICAgdGl0bGVUZXh0ID0gdGl0bGVUZXh0LnJlcGxhY2UociwgZnVuY3Rpb24ocykge1xyXG4gICAgICAgIHZhciBtID0gci5leGVjKHMpO1xyXG4gICAgICAgIHJldHVybiBwcm9wZXJ0aWVzW21bMV1dO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29udGVudCA9ICc8ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LXRpdGxlXCI+PGg0PicgKyB0aXRsZVRleHQgKyAnPC9oND48L2Rpdj48ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LWRlc2NyaXB0aW9uXCIgc3R5bGU9XCJtYXgtaGVpZ2h0OjIwMHB4O292ZXJmbG93OmF1dG87XCI+JztcclxuICAgIFxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb3B1cEluZm8uZmllbGRJbmZvcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS52aXNpYmxlID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQgKz0gJzxkaXYgc3R5bGU9XCJmb250LXdlaWdodDpib2xkO2NvbG9yOiM5OTk7bWFyZ2luLXRvcDo1cHg7d29yZC1icmVhazpicmVhay1hbGw7XCI+JyArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsICsgJzwvZGl2PjxwIHN0eWxlPVwibWFyZ2luLXRvcDowO21hcmdpbi1ib3R0b206NXB4O3dvcmQtYnJlYWs6YnJlYWstYWxsO1wiPicgKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV0gKyAnPC9wPic7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnRlbnQgKz0gJzwvZGl2Pic7XHJcblxyXG4gICAgaWYgKHBvcHVwSW5mby5tZWRpYUluZm9zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAvLyBJdCBkb2VzIG5vdCBzdXBwb3J0IG1lZGlhSW5mb3MgZm9yIHBvcHVwIGNvbnRlbnRzLlxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBjb250ZW50O1xyXG59XHJcblxyXG5leHBvcnQgdmFyIFBvcHVwID0ge1xyXG4gIGNyZWF0ZVBvcHVwQ29udGVudDogY3JlYXRlUG9wdXBDb250ZW50XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBQb3B1cDsiLCJleHBvcnQgZnVuY3Rpb24gY3JlYXRlTGFiZWxUZXh0IChwcm9wZXJ0aWVzLCBsYWJlbGluZ0luZm8pIHtcclxuICAgIC8vY29uc29sZS5sb2coJ2dlbmVyYXRlTGFiZWxzOiAnLCBwcm9wZXJ0aWVzLCBsYWJlbGluZ0luZm8pO1xyXG4gICAgdmFyIHIgPSAvXFxbKFteXFxdXSopXFxdL2c7XHJcbiAgICB2YXIgbGFiZWxUZXh0ID0gbGFiZWxpbmdJbmZvWzBdLmxhYmVsRXhwcmVzc2lvbjtcclxuXHJcbiAgICBsYWJlbFRleHQgPSBsYWJlbFRleHQucmVwbGFjZShyLCBmdW5jdGlvbihzKSB7XHJcbiAgICAgICAgdmFyIG0gPSByLmV4ZWMocyk7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhtWzFdKTtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKHByb3BlcnRpZXNbbVsxXV0pO1xyXG4gICAgICAgIHJldHVybiBwcm9wZXJ0aWVzW21bMV1dO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGxhYmVsVGV4dDtcclxufVxyXG5cclxuZXhwb3J0IHZhciBMYWJlbCA9IHtcclxuICBjcmVhdGVMYWJlbFRleHQ6IGNyZWF0ZUxhYmVsVGV4dFxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgTGFiZWw7IiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcbmltcG9ydCB7IGNyZWF0ZVBvcHVwQ29udGVudCB9IGZyb20gJy4vUG9wdXAvUG9wdXAnO1xyXG5pbXBvcnQgeyBjcmVhdGVMYWJlbFRleHQgfSBmcm9tICcuL0xhYmVsL0xhYmVsJztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvcGVyYXRpb25hbExheWVyIChsYXllciwgbGF5ZXJzLCBtYXApIHtcclxuICByZXR1cm4gX2dlbmVyYXRlRXNyaUxheWVyKGxheWVyLCBsYXllcnMsIG1hcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZ2VuZXJhdGVFc3JpTGF5ZXIgKGxheWVyLCBsYXllcnMsIG1hcCkge1xyXG4gICAgY29uc29sZS5sb2coJ2dlbmVyYXRlRXNyaUxheWVyOiAnLCBsYXllci50aXRsZSwgbGF5ZXIpO1xyXG5cclxuICAgIGlmKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAvLyBTdXBwb3J0aW5nIG9ubHkgcG9pbnQgZ2VvbWV0cnlcclxuICAgICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEZlYXR1cmVDb2xsZWN0aW9uJyk7XHJcbiAgICAgICAgdmFyIHJlbmRlcmVyID0gbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzWzBdLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlcjtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKHJlbmRlcmVyKTtcclxuICAgICAgICB2YXIgZmVhdHVyZXMgPSBbXTtcclxuICAgICAgICB2YXIgbGFiZWxzID0gW107XHJcblxyXG4gICAgICAgIGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5mZWF0dXJlU2V0LmZlYXR1cmVzLm1hcChmdW5jdGlvbihmZWF0dXJlKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgaWNvbiA9IF9nZW5lcmF0ZUljb24ocmVuZGVyZXIsIGZlYXR1cmUuYXR0cmlidXRlcyk7XHJcbiAgICAgICAgICAgIHZhciBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGZlYXR1cmUuZ2VvbWV0cnkueCwgZmVhdHVyZS5nZW9tZXRyeS55KSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgZiA9IEwubWFya2VyKG1lcmNhdG9yVG9MYXRsbmcsIHsgaWNvbjogaWNvbiwgb3BhY2l0eTogbGF5ZXIub3BhY2l0eSB9KTtcclxuXHJcbiAgICAgICAgICAgIGlmKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbMF0ucG9wdXBJbmZvLCBmZWF0dXJlLmF0dHJpYnV0ZXMpO1xyXG4gICAgICAgICAgICAgICAgZi5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYobGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzWzBdLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGxhYmVsaW5nSW5mbyA9IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xyXG4gICAgICAgICAgICAgICAgdmFyIGxhYmVsVGV4dCA9IGNyZWF0ZUxhYmVsVGV4dChmZWF0dXJlLmF0dHJpYnV0ZXMsIGxhYmVsaW5nSW5mbyk7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCBMZWFmbGV0LmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICAgLy9mLmJpbmRMYWJlbChsYWJlbFRleHQsIHsgbm9IaWRlOiB0cnVlIH0pLnNob3dMYWJlbCgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyB3aXRob3V0IExlYWZsZXQubGFiZWxcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWwgPSBMLm1hcmtlcihtZXJjYXRvclRvTGF0bG5nLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHpJbmRleE9mZnNldDogMSxcclxuICAgICAgICAgICAgICAgICAgICBpY29uOiBMLmRpdkljb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIGljb25TaXplOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogJ3BvaW50LWxhYmVsJyxcclxuICAgICAgICAgICAgICAgICAgICBodG1sOiAnPGRpdj4nICsgbGFiZWxUZXh0ICsgJzwvZGl2PidcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmZWF0dXJlcy5wdXNoKGYpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB2YXIgbHlyID0gTC5mZWF0dXJlR3JvdXAoZmVhdHVyZXMpO1xyXG5cclxuICAgICAgICBpZihsYWJlbHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB2YXIgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG4gICAgICAgICAgICBseXIgPSBMLmxheWVyR3JvdXAoW2x5ciwgbGFiZWxzTGF5ZXJdKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZDJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNGZWF0dXJlTGF5ZXInICYmIGxheWVyLmxheWVyRGVmaW5pdGlvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgaWYobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvICE9PSB1bmRlZmluZWQpe1xyXG4gICAgICAgICAgICBpZihsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIudHlwZSA9PT0gJ2hlYXRtYXAnKXtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgSGVhdG1hcExheWVyJyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgZ3JhZGllbnQgPSB7fTtcclxuXHJcbiAgICAgICAgICAgICAgICBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuY29sb3JTdG9wcy5tYXAoZnVuY3Rpb24oc3RvcCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhZGllbnRbc3RvcC5yYXRpb10gPSAncmdiYSgnICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJywnICsgKHN0b3AuY29sb3JbM10vMjU1KSArICcpJztcclxuICAgICAgICAgICAgICAgICAgICAvL2dyYWRpZW50W01hdGgucm91bmQoc3RvcC5yYXRpbyoxMDApLzEwMF0gPSAncmdiKCcgKyBzdG9wLmNvbG9yWzBdICsgJywnICsgc3RvcC5jb2xvclsxXSArICcsJyArIHN0b3AuY29sb3JbMl0gKyAnKSc7XHJcbiAgICAgICAgICAgICAgICAgICAgZ3JhZGllbnRbKE1hdGgucm91bmQoc3RvcC5yYXRpbyoxMDApLzEwMCs2KS83XSA9ICdyZ2IoJyArIHN0b3AuY29sb3JbMF0gKyAnLCcgKyBzdG9wLmNvbG9yWzFdICsgJywnICsgc3RvcC5jb2xvclsyXSArICcpJztcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIpO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBseXIgPSBMLmVzcmkuSGVhdC5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDIuMFxyXG4gICAgICAgICAgICAgICAgLy92YXIgbHlyID0gTC5lc3JpLmhlYXRtYXBGZWF0dXJlTGF5ZXIoeyAvLyBFc3JpIExlYWZsZXQgMS4wXHJcbiAgICAgICAgICAgICAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgICAgICAgICAgICAgbWluT3BhY2l0eTogMC41LFxyXG4gICAgICAgICAgICAgICAgICAgIG1heDogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLm1heFBpeGVsSW50ZW5zaXR5LFxyXG4gICAgICAgICAgICAgICAgICAgIGJsdXI6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5ibHVyUmFkaXVzLFxyXG4gICAgICAgICAgICAgICAgICAgIHJhZGl1czogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLmJsdXJSYWRpdXMgKiAxLjMsXHJcbiAgICAgICAgICAgICAgICAgICAgZ3JhZGllbnQ6IGdyYWRpZW50XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnSEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGx5cjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyICh3aXRoIGxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mbyknKTtcclxuICAgICAgICAgICAgICAgIHZhciByZW5kZXJlciA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlcjtcclxuICAgICAgICAgICAgICAgIHZhciB3aGVyZSA9ICcxPTEnO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgd2hlcmUgPSBsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb247XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGxhYmVscyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgdmFyIGxhYmVsc0xheWVyID0gTC5mZWF0dXJlR3JvdXAobGFiZWxzKTtcclxuICAgICAgICAgICAgICAgIHZhciBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICAgICAgICAgICAgICB3aGVyZTogd2hlcmUsXHJcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlUmVuZGVyZXI6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRUb0xheWVyOiBmdW5jdGlvbiAoZ2VvanNvbiwgbGF0bG5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coZ2VvanNvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpY29uID0gX2dlbmVyYXRlSWNvbihyZW5kZXJlciwgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmID0gTC5tYXJrZXIobGF0bG5nLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uOiBpY29uLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3BhY2l0eTogbGF5ZXIub3BhY2l0eVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU6IGZ1bmN0aW9uIChnZW9qc29uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXRoT3B0aW9ucztcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhnZW9qc29uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZ2VvanNvbi5nZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycgfHwgZ2VvanNvbi5nZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJyB8fCBnZW9qc29uLmdlb21ldHJ5LnR5cGUgPT09ICdQb2x5Z29uJyB8fCBnZW9qc29uLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoT3B0aW9ucyA9IF9nZW5lcmF0ZVBhdGhTdHlsZShyZW5kZXJlciwgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coZ2VvanNvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXRoT3B0aW9ucztcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGxheWVyLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWxpbmdJbmZvID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsYWJlbFRleHQgPSBjcmVhdGVMYWJlbFRleHQoZ2VvanNvbi5wcm9wZXJ0aWVzLCBsYWJlbGluZ0luZm8pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhsYWJlbFRleHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCBMZWFmbGV0LmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2YuYmluZExhYmVsKGxhYmVsVGV4dCwgeyBub0hpZGU6IHRydWUgfSkuc2hvd0xhYmVsKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhnZW9qc29uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cobCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWxQb3M7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWxDbGFzc05hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ1BvaW50Jykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzLnJldmVyc2UoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbENsYXNzTmFtZSA9ICdwb2ludC1sYWJlbCc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGMubGVuZ3RoLzIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coY1tjZW50cmFsS2V5XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWxQb3MgPSBjW2NlbnRyYWxLZXldLnJldmVyc2UoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbENsYXNzTmFtZSA9ICdwYXRoLWxhYmVsJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8ubG9nKGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGMubGVuZ3RoLzIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjMiA9IGNbY2VudHJhbEtleV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGMyLmxlbmd0aC8yKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGMyW2NlbnRyYWxLZXldKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IGMyW2NlbnRyYWxLZXldLnJldmVyc2UoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbENsYXNzTmFtZSA9ICdwYXRoLWxhYmVsJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gbC5nZXRCb3VuZHMoKS5nZXRDZW50ZXIoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGxhYmVsUG9zKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbENsYXNzTmFtZSA9ICdwYXRoLWxhYmVsJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdpdGhvdXQgTGVhZmxldC5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxhYmVsID0gTC5tYXJrZXIobGFiZWxQb3MsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbjogTC5kaXZJY29uKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvblNpemU6IG51bGwsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogbGFiZWxDbGFzc05hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0bWw6ICc8ZGl2PicgKyBsYWJlbFRleHQgKyAnPC9kaXY+J1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbHNMYXllci5hZGRMYXllcihsYWJlbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBseXIgPSBMLmxheWVyR3JvdXAoW2x5ciwgbGFiZWxzTGF5ZXJdKTtcclxuXHJcbiAgICAgICAgICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllciAod2l0aG91dCBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8pJyk7XHJcbiAgICAgICAgICAgIHZhciB3aGVyZSA9ICcxPTEnO1xyXG5cclxuICAgICAgICAgICAgaWYobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHdoZXJlID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XHJcbiAgICAgICAgICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICAgICAgICAgIHdoZXJlOiB3aGVyZSxcclxuICAgICAgICAgICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8qbHlyLm1ldGFkYXRhKGZ1bmN0aW9uKGVycm9yLCByZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyb3IsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyb3IpIHsgY29uc29sZS5sb2coZXJyb3IpOyB9KTsqL1xyXG5cclxuICAgICAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRkwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2UgaWYobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTRmVhdHVyZUxheWVyJykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyJyk7XHJcbiAgICAgICAgdmFyIGx5ciA9IEwuZXNyaS5mZWF0dXJlTGF5ZXIoe1xyXG4gICAgICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICAgICAgb25FYWNoRmVhdHVyZTogZnVuY3Rpb24gKGdlb2pzb24sIGwpIHtcclxuICAgICAgICAgICAgICAgIGlmKGxheWVyLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcG9pbnRUb0xheWVyOiBmdW5jdGlvbiAoZ2VvanNvbiwgbGF0bG5nKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGYgPSBMLm1hcmtlcihsYXRsbmcsIHtcclxuICAgICAgICAgICAgICAgICAgICAvL2ljb246IGljb24sXHJcbiAgICAgICAgICAgICAgICAgICAgb3BhY2l0eTogbGF5ZXIub3BhY2l0eVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGY7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLypseXIubWV0YWRhdGEoZnVuY3Rpb24oZXJyb3IsIHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yLCByZXNwb25zZSk7XHJcbiAgICAgICAgfSwgZnVuY3Rpb24oZXJyb3IpIHsgY29uc29sZS5sb2coZXJyb3IpOyB9KTsqL1xyXG5cclxuICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGx5cjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTSW1hZ2VTZXJ2aWNlTGF5ZXInKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNJbWFnZVNlcnZpY2VMYXllcicpO1xyXG4gICAgICAgIHZhciBseXIgPSBMLmVzcmkuaW1hZ2VNYXBMYXllcih7XHJcbiAgICAgICAgICAgIHVybDogbGF5ZXIudXJsXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0lNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGx5cjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTTWFwU2VydmljZUxheWVyJykge1xyXG4gICAgICAgIHZhciBseXIgPSBMLmVzcmkuZHluYW1pY01hcExheWVyKHtcclxuICAgICAgICAgICAgdXJsOiBsYXllci51cmxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRE1MJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNUaWxlZE1hcFNlcnZpY2VMYXllcicpIHtcclxuICAgIHRyeSB7XHJcbiAgICB2YXIgbHlyID0gTC5lc3JpLmJhc2VtYXBMYXllcihsYXllci50aXRsZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZSkge1xyXG4gICAgdmFyIGx5ciA9IEwuZXNyaS50aWxlZE1hcExheWVyKHtcclxuICAgICAgICAgICAgdXJsOiBsYXllci51cmxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICBMLmVzcmkucmVxdWVzdChsYXllci51cmwsIHt9LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcclxuICAgICAgICB2YXIgbWF4V2lkdGggPSAobWFwLmdldFNpemUoKS54IC0gNTUpO1xyXG4gICAgICAgIHZhciB0aWxlZEF0dHJpYnV0aW9uID0gJzxzcGFuIGNsYXNzPVwiZXNyaS1hdHRyaWJ1dGlvbnNcIiBzdHlsZT1cImxpbmUtaGVpZ2h0OjE0cHg7IHZlcnRpY2FsLWFsaWduOiAtM3B4OyB0ZXh0LW92ZXJmbG93OmVsbGlwc2lzOyB3aGl0ZS1zcGFjZTpub3dyYXA7IG92ZXJmbG93OmhpZGRlbjsgZGlzcGxheTppbmxpbmUtYmxvY2s7IG1heC13aWR0aDonICsgbWF4V2lkdGggKyAncHg7XCI+JyArIHJlcy5jb3B5cmlnaHRUZXh0ICsgJzwvc3Bhbj4nXHJcbiAgICAgICAgbWFwLmF0dHJpYnV0aW9uQ29udHJvbC5hZGRBdHRyaWJ1dGlvbih0aWxlZEF0dHJpYnV0aW9uKTtcclxuICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ1RNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuICAgIHJldHVybiBseXI7XHJcblxyXG4gICAgfVxyXG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICdPcGVuU3RyZWV0TWFwJykge1xyXG4gICAgICAgIHZhciBseXIgPSBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xyXG4gICAgICAgICAgICBhdHRyaWJ1dGlvbjogJyZjb3B5OyA8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T3BlblN0cmVldE1hcDwvYT4gY29udHJpYnV0b3JzJ1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdUTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCBsYXllci5pZCB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGx5cjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYobGF5ZXIubGF5ZXJUeXBlID09PSAnV2ViVGlsZWRMYXllcicpIHtcclxuICAgICAgICB2YXIgbHlyVXJsID0gX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldChsYXllci50ZW1wbGF0ZVVybCk7XHJcbiAgICAgICAgdmFyIGx5ciA9IEwudGlsZUxheWVyKGx5clVybCwge1xyXG4gICAgICAgICAgICBhdHRyaWJ1dGlvbjogbGF5ZXIuY29weXJpZ2h0XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ1RMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8IGxheWVyLmlkIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICcnKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgdmFyIGx5ciA9IEwuZmVhdHVyZUdyb3VwKFtdKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnVW5zdXBwb3J0ZWQgTGF5ZXI6ICcsIGxheWVyKTtcclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxuLy8gaSB3aWxsIGR1cGxpY2F0ZSB0aGUgYmVsb3cgZnVuY3Rpb25zXHJcbi8vIGFuZCByZXBsYWNlIGVzcmktbGVhZmxldC1yZW5kZXJlcnMuXHJcbmV4cG9ydCBmdW5jdGlvbiBfcG9pbnRTeW1ib2wgKHN5bWJvbCkge1xyXG4gICAgdmFyIGljb247XHJcblxyXG4gICAgICAgIGlmKHN5bWJvbC50eXBlID09PSAnZXNyaVBNUycpIHtcclxuICAgICAgICAgICAgdmFyIGljb25VcmwgPSBzeW1ib2wudXJsO1xyXG5cclxuICAgICAgICAgICAgaWYoc3ltYm9sLmltYWdlRGF0YSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBpY29uVXJsID0gJ2RhdGE6JyArIHN5bWJvbC5jb250ZW50VHlwZSArICc7YmFzZTY0LCcgKyBzeW1ib2wuaW1hZ2VEYXRhO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpY29uID0gTC5pY29uKHtcclxuICAgICAgICAgICAgICAgIGljb25Vcmw6IGljb25VcmwsXHJcbiAgICAgICAgICAgICAgICBzaGFkb3dVcmw6ICcnLFxyXG4gICAgICAgICAgICAgICAgaWNvblNpemU6ICAgICBbKHN5bWJvbC5oZWlnaHQqNC8zKSwgKHN5bWJvbC53aWR0aCo0LzMpXSxcclxuICAgICAgICAgICAgICAgIHNoYWRvd1NpemU6ICAgWzAsIDBdLFxyXG4gICAgICAgICAgICAgICAgaWNvbkFuY2hvcjogICBbKHN5bWJvbC5oZWlnaHQqNC8zKS0xNiwgKHN5bWJvbC53aWR0aCo0LzMpLTFdLFxyXG4gICAgICAgICAgICAgICAgc2hhZG93QW5jaG9yOiBbMCwgMF0sXHJcbiAgICAgICAgICAgICAgICBwb3B1cEFuY2hvcjogIFsoc3ltYm9sLndpZHRoKjQvMykvMywgKHN5bWJvbC5oZWlnaHQqNC8zKSotMV1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKHN5bWJvbC50eXBlID09PSAnZXNyaVNNUycpIHtcclxuICAgICAgICAgICAgaWYoc3ltYm9sLnN0eWxlID09PSAnZXNyaVNNU0NpcmNsZScpIHtcclxuICAgICAgICAgICAgICAgIGlmKHN5bWJvbC5vdXRsaW5lLnN0eWxlID09PSAnZXNyaVNMU051bGwnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWNvbiA9IEwudmVjdG9ySWNvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xhc3NOYW1lOiAnbXktdmVjdG9yLWljb24nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdIZWlnaHQ6ICgoc3ltYm9sLnNpemUqNC8zKS8yICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMykpICogMixcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3ZnV2lkdGg6ICgoc3ltYm9sLnNpemUqNC8zKS8yICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMykpICogMixcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NpcmNsZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYXBlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByOiAoc3ltYm9sLnNpemUqNC8zKS8yICsgJycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeDogKHN5bWJvbC5zaXplKjQvMykvMiArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3k6IChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbDogJ3JnYmEoJyArIHN5bWJvbC5jb2xvclswXSArICcsJyArIHN5bWJvbC5jb2xvclsxXSArICcsJyArIHN5bWJvbC5jb2xvclsyXSArICcsJyArIHN5bWJvbC5jb2xvclszXS8yNTUgKyAnKScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3N0cm9rZTogJycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2VXaWR0aDogMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpY29uID0gTC52ZWN0b3JJY29uKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jbGFzc05hbWU6ICdteS12ZWN0b3ItaWNvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z0hlaWdodDogKChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdXaWR0aDogKChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY2lyY2xlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2hhcGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHI6IChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN4OiAoc3ltYm9sLnNpemUqNC8zKS8yICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeTogKHN5bWJvbC5zaXplKjQvMykvMiArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxsOiAncmdiYSgnICsgc3ltYm9sLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLmNvbG9yWzJdICsgJywnICsgc3ltYm9sLmNvbG9yWzNdLzI1NSArICcpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZTogJ3JnYmEoJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLm91dGxpbmUuY29sb3JbMV0gKyAnLCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclsyXSArICcsJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzNdLzI1NSArICcpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZVdpZHRoOiAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZihzeW1ib2wuc3R5bGUgPT09ICdlc3JpU01TU3F1YXJlJykge1xyXG4gICAgICAgICAgICAgICAgaWYoc3ltYm9sLm91dGxpbmUuc3R5bGUgPT09ICdlc3JpU0xTTnVsbCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBpY29uID0gTC52ZWN0b3JJY29uKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jbGFzc05hbWU6ICdteS12ZWN0b3ItaWNvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z0hlaWdodDogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSAqIDIgKyAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdXaWR0aDogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSAqIDIgKyAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYXBlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4OiAnMScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiAnMScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogKHN5bWJvbC5zaXplKjQvMykgKyAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogKHN5bWJvbC5zaXplKjQvMykgKyAnJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbDogJ3JnYmEoJyArIHN5bWJvbC5jb2xvclswXSArICcsJyArIHN5bWJvbC5jb2xvclsxXSArICcsJyArIHN5bWJvbC5jb2xvclsyXSArICcsJyArIHN5bWJvbC5jb2xvclszXS8yNTUgKyAnKScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3N0cm9rZTogJycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2VXaWR0aDogMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpY29uID0gTC52ZWN0b3JJY29uKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jbGFzc05hbWU6ICdteS12ZWN0b3ItaWNvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z0hlaWdodDogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSAqIDIgKyAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdXaWR0aDogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSAqIDIgKyAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYXBlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4OiAnMScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiAnMScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogKHN5bWJvbC5zaXplKjQvMykgKyAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogKHN5bWJvbC5zaXplKjQvMykgKyAnJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbDogJ3JnYmEoJyArIHN5bWJvbC5jb2xvclswXSArICcsJyArIHN5bWJvbC5jb2xvclsxXSArICcsJyArIHN5bWJvbC5jb2xvclsyXSArICcsJyArIHN5bWJvbC5jb2xvclszXS8yNTUgKyAnKScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2U6ICdyZ2JhKCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclswXSArICcsJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLm91dGxpbmUuY29sb3JbMl0gKyAnLCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclszXS8yNTUgKyAnKScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2VXaWR0aDogKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8qZWxzZSBpZihzeW1ib2wuc3R5bGUgPT09ICdlc3JpU01TRGlhbW9uZCcpIHtcclxuICAgICAgICAgICAgICAgIGlmKHN5bWJvbC5vdXRsaW5lLnN0eWxlID09PSAnZXNyaVNMU051bGwnKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcblxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9Ki9cclxuICAgICAgICAgICAgZWxzZSBpZihzeW1ib2wuc3R5bGUgPT09ICcnKSB7XHJcbiAgICAgICAgICAgICAgICBpZihzeW1ib2wub3V0bGluZS5zdHlsZSA9PT0gJ2VzcmlTTFNOdWxsJykge1xyXG5cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG5cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBPdGhlciBTTVNzIC0+IENpcmNsZVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmKHN5bWJvbC5vdXRsaW5lLnN0eWxlID09PSAnZXNyaVNMU051bGwnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWNvbiA9IEwudmVjdG9ySWNvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xhc3NOYW1lOiAnbXktdmVjdG9yLWljb24nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdIZWlnaHQ6ICgoc3ltYm9sLnNpemUqNC8zKSArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpKSAqIDIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z1dpZHRoOiAoKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY2lyY2xlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2hhcGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHI6IChzeW1ib2wuc2l6ZSo0LzMpICsgJycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeDogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN5OiAoc3ltYm9sLnNpemUqNC8zKSArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxsOiAncmdiYSgnICsgc3ltYm9sLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLmNvbG9yWzJdICsgJywnICsgc3ltYm9sLmNvbG9yWzNdLzI1NSArICcpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vc3Ryb2tlOiAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZVdpZHRoOiAwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGljb24gPSBMLnZlY3Rvckljb24oe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NsYXNzTmFtZTogJ215LXZlY3Rvci1pY29uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3ZnSGVpZ2h0OiAoKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdXaWR0aDogKChzeW1ib2wuc2l6ZSo0LzMpICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMykpICogMixcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NpcmNsZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYXBlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByOiAoc3ltYm9sLnNpemUqNC8zKSArICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3g6IChzeW1ib2wuc2l6ZSo0LzMpICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeTogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbDogJ3JnYmEoJyArIHN5bWJvbC5jb2xvclswXSArICcsJyArIHN5bWJvbC5jb2xvclsxXSArICcsJyArIHN5bWJvbC5jb2xvclsyXSArICcsJyArIHN5bWJvbC5jb2xvclszXS8yNTUgKyAnKScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2U6ICdyZ2JhKCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclswXSArICcsJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLm91dGxpbmUuY29sb3JbMl0gKyAnLCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclszXS8yNTUgKyAnKScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2VXaWR0aDogKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gaWNvbjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9wYXRoU3ltYm9sIChzeW1ib2wpIHtcclxuICAgIHZhciBzdHlsZTtcclxuXHJcbiAgICBpZihzeW1ib2wuc3R5bGUgPT09ICdlc3JpU0xTU29saWQnKSB7XHJcbiAgICAgICAgc3R5bGUgPSB7XHJcbiAgICAgICAgICAgIGNvbG9yOiAncmdiYSgnICsgc3ltYm9sLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLmNvbG9yWzJdICsgJywnICsgc3ltYm9sLmNvbG9yWzNdLzI1NSArICcpJyxcclxuICAgICAgICAgICAgd2VpZ2h0OiAoc3ltYm9sLnNpemUqNC8zKSB8fCAoc3ltYm9sLndpZHRoKjQvMylcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYoc3ltYm9sLnN0eWxlID09PSAnZXNyaVNGU1NvbGlkJykge1xyXG4gICAgICAgIHZhciBjb2xvciA9IHN5bWJvbC5jb2xvclxyXG4gICAgICAgIHZhciBvdXRsaW5lQ29sb3IgPSBzeW1ib2wub3V0bGluZS5jb2xvcjtcclxuXHJcbiAgICAgICAgaWYoc3ltYm9sLmNvbG9yID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNvbG9yID0gWzAsMCwwLDBdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc3ltYm9sLm91dGxpbmUuY29sb3IgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgb3V0bGluZUNvbG9yID0gWzAsMCwwLDBdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc3R5bGUgPSB7XHJcbiAgICAgICAgICAgIGZpbGxDb2xvcjogJ3JnYignICsgY29sb3JbMF0gKyAnLCcgKyBjb2xvclsxXSArICcsJyArIGNvbG9yWzJdICsgJyknLFxyXG4gICAgICAgICAgICBmaWxsT3BhY2l0eTogY29sb3JbM10vMjU1LFxyXG4gICAgICAgICAgICBjb2xvcjogJ3JnYmEoJyArIG91dGxpbmVDb2xvclswXSArICcsJyArIG91dGxpbmVDb2xvclsxXSArICcsJyArIG91dGxpbmVDb2xvclsyXSArICcsJyArIG91dGxpbmVDb2xvclszXS8yNTUgKyAnKScsXHJcbiAgICAgICAgICAgIHdlaWdodDogKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHN0eWxlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX2NhbFZpc3VhbFZhcmlhYmxlcyAoc3ltYm9sLCB2aXN1YWxWYXJpYWJsZXMsIHByb3BlcnRpZXMpIHtcclxuICAgIHZhciB2dlN5bWJvbCA9IHN5bWJvbDtcclxuICAgIC8vdmFyIHZhbHVlID0gcHJvcGVydGllc1t2aXN1YWxWYXJpYWJsZXNbMF0uZmllbGRdO1xyXG5cclxuICAgIHZpc3VhbFZhcmlhYmxlcy5tYXAoZnVuY3Rpb24gKHZ2KSB7XHJcbiAgICAgICAgdmFyIHZhbHVlID0gcHJvcGVydGllc1t2di5maWVsZF07XHJcblxyXG4gICAgICAgIGlmKHZ2LnR5cGUgPT09ICdzaXplSW5mbycpIHtcclxuICAgICAgICAgICAgdmFyIHJhdGUgPSAodmFsdWUgLSB2di5taW5EYXRhVmFsdWUpLyh2di5tYXhEYXRhVmFsdWUgLSB2di5taW5EYXRhVmFsdWUpO1xyXG4gICAgICAgICAgICB2YXIgc3VibWl0U2l6ZSA9IChyYXRlICogKHZ2Lm1heFNpemUgLSB2di5taW5TaXplKSkgKyB2di5taW5TaXplO1xyXG4gICAgICAgICAgICB2dlN5bWJvbC5zaXplID0gc3VibWl0U2l6ZTtcclxuICAgICAgICAgICAgaWYodmFsdWUgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHZ2U3ltYm9sLnNpemUgPSA2O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYodnYudHlwZSA9PT0gJ2NvbG9ySW5mbycpIHtcclxuICAgICAgICAgICAgLy8gQ29sb3IgUmFtcFxyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKHN5bWJvbC5jb2xvcik7XHJcbiAgICAgICAgICAgIHZhciBzdG9wcyA9IHZ2LnN0b3BzO1xyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKHZ2LnN0b3BzKTtcclxuICAgICAgICAgICAgc3RvcHMubWFwKGZ1bmN0aW9uKHN0b3AsIGkpIHtcclxuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ2Jhc2UgY29sb3I6ICcsIHN0b3AuY29sb3IpO1xyXG4gICAgICAgICAgICAgICAgaWYoaSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHN0b3AudmFsdWUgPiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3VibWl0Q29sb3IgPSBzdG9wLmNvbG9yO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2dlN5bWJvbC5jb2xvciA9IHN1Ym1pdENvbG9yO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdtaW46ICcsIHZ2U3ltYm9sLmNvbG9yKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKGkgPT09IHN0b3BzLmxlbmd0aC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoc3RvcC52YWx1ZSA8PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3VibWl0Q29sb3IgPSBzdG9wLmNvbG9yO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2dlN5bWJvbC5jb2xvciA9IHN1Ym1pdENvbG9yO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdtYXg6ICcsIHZ2U3ltYm9sLmNvbG9yKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihzdG9wLnZhbHVlID4gdmFsdWUgJiYgc3RvcHNbaS0xXS52YWx1ZSA8PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3VibWl0Q29sb3IgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJhdGUgPSAodmFsdWUgLSBzdG9wc1tpLTFdLnZhbHVlKS8oc3RvcC52YWx1ZSAtIHN0b3BzW2ktMV0udmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2dlN5bWJvbC5jb2xvci5tYXAoZnVuY3Rpb24oY29sb3IsIGopIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1Ym1pdENvbG9yW2pdID0gTWF0aC5yb3VuZCgocmF0ZSAqIChzdG9wLmNvbG9yW2pdIC0gc3RvcHNbaS0xXS5jb2xvcltqXSkpICsgc3RvcHNbaS0xXS5jb2xvcltqXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2dlN5bWJvbC5jb2xvciA9IHN1Ym1pdENvbG9yO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKHZ2U3ltYm9sLmNvbG9yKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB2dlN5bWJvbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9nZW5lcmF0ZVBhdGhTdHlsZSAocmVuZGVyZXIsIHByb3BlcnRpZXMpIHtcclxuICAgIHZhciBzdHlsZSA9IHt9O1xyXG5cclxuICAgIGlmKHJlbmRlcmVyLnR5cGUgPT09ICdzaW1wbGUnKSB7XHJcbiAgICAgICAgc3R5bGUgPSBfcGF0aFN5bWJvbChyZW5kZXJlci5zeW1ib2wpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKHJlbmRlcmVyLnR5cGUgPT09ICd1bmlxdWVWYWx1ZScpIHtcclxuICAgICAgICByZW5kZXJlci51bmlxdWVWYWx1ZUluZm9zLm1hcChmdW5jdGlvbihpbmZvKSB7XHJcbiAgICAgICAgICAgIGlmKGluZm8udmFsdWUgPT09IHByb3BlcnRpZXNbcmVuZGVyZXIuZmllbGQxXSkgeyAvLyBmaWVsZDIsIGZpZWxkM+OBr+W+jOOBp+iAg+OBiOOCiOOBhlxyXG4gICAgICAgICAgICAgICAgdmFyIHN5bWJvbCA9IGluZm8uc3ltYm9sO1xyXG4gICAgICAgICAgICAgICAgaWYocmVuZGVyZXIudmlzdWFsVmFyaWFibGVzICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBzeW1ib2wgPSBfY2FsVmlzdWFsVmFyaWFibGVzKGluZm8uc3ltYm9sLCByZW5kZXJlci52aXN1YWxWYXJpYWJsZXMsIHByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgc3R5bGUgPSBfcGF0aFN5bWJvbChzeW1ib2wpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYocmVuZGVyZXIudHlwZSA9PT0gJ2NsYXNzQnJlYWtzJykge1xyXG4gICAgICAgIHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvcy5tYXAoZnVuY3Rpb24oaW5mbywgaSkge1xyXG4gICAgICAgICAgICB2YXIgcHJldkluZm87XHJcbiAgICAgICAgICAgIHZhciBzeW1ib2wgPSBpbmZvLnN5bWJvbDtcclxuXHJcbiAgICAgICAgICAgIGlmKGkgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHByZXZJbmZvID0gcmVuZGVyZXIubWluVmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBwcmV2SW5mbyA9IHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvc1tpLTFdLmNsYXNzTWF4VmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhpbmZvLmNsYXNzTWF4VmFsdWUsIHByb3BlcnRpZXNbcmVuZGVyZXIuZmllbGRdLCBwcmV2SW5mbyk7XHJcblxyXG4gICAgICAgICAgICBpZihyZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MubGVuZ3RoID09PSAoaSsxKSkge1xyXG4gICAgICAgICAgICAgICAgaWYoaW5mby5jbGFzc01heFZhbHVlID49IHByb3BlcnRpZXNbcmVuZGVyZXIuZmllbGRdICYmIHByZXZJbmZvIDw9IHByb3BlcnRpZXNbcmVuZGVyZXIuZmllbGRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYocmVuZGVyZXIudmlzdWFsVmFyaWFibGVzICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3ltYm9sID0gX2NhbFZpc3VhbFZhcmlhYmxlcyhpbmZvLnN5bWJvbCwgcmVuZGVyZXIudmlzdWFsVmFyaWFibGVzLCBwcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGUgPSBfcGF0aFN5bWJvbChpbmZvLnN5bWJvbCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZihpbmZvLmNsYXNzTWF4VmFsdWUgPiBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSAmJiBwcmV2SW5mbyA8PSBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHJlbmRlcmVyLnZpc3VhbFZhcmlhYmxlcyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN5bWJvbCA9IF9jYWxWaXN1YWxWYXJpYWJsZXMoaW5mby5zeW1ib2wsIHJlbmRlcmVyLnZpc3VhbFZhcmlhYmxlcywgcHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHN0eWxlID0gX3BhdGhTeW1ib2woaW5mby5zeW1ib2wpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHN0eWxlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX2dlbmVyYXRlSWNvbiAocmVuZGVyZXIsIHByb3BlcnRpZXMpIHtcclxuICAgIC8vY29uc29sZS5sb2cocmVuZGVyZXIpO1xyXG4gICAgdmFyIGljb247XHJcblxyXG4gICAgaWYocmVuZGVyZXIudHlwZSA9PT0gJ3NpbXBsZScpIHtcclxuICAgICAgICBpY29uID0gX3BvaW50U3ltYm9sKHJlbmRlcmVyLnN5bWJvbCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYocmVuZGVyZXIudHlwZSA9PT0gJ3VuaXF1ZVZhbHVlJykge1xyXG4gICAgICAgIHJlbmRlcmVyLnVuaXF1ZVZhbHVlSW5mb3MubWFwKGZ1bmN0aW9uKGluZm8pIHtcclxuICAgICAgICAgICAgaWYoaW5mby52YWx1ZSA9PT0gcHJvcGVydGllc1tyZW5kZXJlci5maWVsZDFdKSB7IC8vIGZpZWxkMiwgZmllbGQz44Gv5b6M44Gn6ICD44GI44KI44GGXHJcbiAgICAgICAgICAgICAgICB2YXIgc3ltYm9sID0gaW5mby5zeW1ib2w7XHJcbiAgICAgICAgICAgICAgICBpZihyZW5kZXJlci52aXN1YWxWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN5bWJvbCA9IF9jYWxWaXN1YWxWYXJpYWJsZXMoaW5mby5zeW1ib2wsIHJlbmRlcmVyLnZpc3VhbFZhcmlhYmxlcywgcHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKHN5bWJvbCk7XHJcbiAgICAgICAgICAgICAgICBpY29uID0gX3BvaW50U3ltYm9sKHN5bWJvbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZihyZW5kZXJlci50eXBlID09PSAnY2xhc3NCcmVha3MnKSB7XHJcbiAgICAgICAgcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zLm1hcChmdW5jdGlvbihpbmZvLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBwcmV2SW5mbztcclxuICAgICAgICAgICAgdmFyIHN5bWJvbCA9IGluZm8uc3ltYm9sO1xyXG5cclxuICAgICAgICAgICAgaWYoaSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgcHJldkluZm8gPSByZW5kZXJlci5taW5WYWx1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHByZXZJbmZvID0gcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zW2ktMV0uY2xhc3NNYXhWYWx1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKGluZm8uY2xhc3NNYXhWYWx1ZSwgcHJvcGVydGllc1tyZW5kZXJlci5maWVsZF0sIHByZXZJbmZvKTtcclxuXHJcbiAgICAgICAgICAgIGlmKHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvcy5sZW5ndGggPT09IChpKzEpKSB7XHJcbiAgICAgICAgICAgICAgICBpZihpbmZvLmNsYXNzTWF4VmFsdWUgPj0gcHJvcGVydGllc1tyZW5kZXJlci5maWVsZF0gJiYgcHJldkluZm8gPD0gcHJvcGVydGllc1tyZW5kZXJlci5maWVsZF0pIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihyZW5kZXJlci52aXN1YWxWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzeW1ib2wgPSBfY2FsVmlzdWFsVmFyaWFibGVzKGluZm8uc3ltYm9sLCByZW5kZXJlci52aXN1YWxWYXJpYWJsZXMsIHByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpY29uID0gX3BvaW50U3ltYm9sKHN5bWJvbCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZihpbmZvLmNsYXNzTWF4VmFsdWUgPiBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSAmJiBwcmV2SW5mbyA8PSBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHJlbmRlcmVyLnZpc3VhbFZhcmlhYmxlcyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN5bWJvbCA9IF9jYWxWaXN1YWxWYXJpYWJsZXMoaW5mby5zeW1ib2wsIHJlbmRlcmVyLnZpc3VhbFZhcmlhYmxlcywgcHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGljb24gPSBfcG9pbnRTeW1ib2woaW5mby5zeW1ib2wpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGljb247XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZXNyaVdUTFVybFRlbXBsYXRlVG9MZWFmbGV0ICh1cmwpIHtcclxuICAgIHZhciByID0gL1xceyhbXlxcXV0qKVxcfS9nO1xyXG4gICAgdmFyIG5ld1VybCA9IHVybDtcclxuXHJcbiAgICBuZXdVcmwgPSBuZXdVcmwucmVwbGFjZSgvXFx7bGV2ZWx9L2csICd7en0nKTtcclxuICAgIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtjb2x9L2csICd7eH0nKTtcclxuICAgIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtyb3d9L2csICd7eX0nKTtcclxuICAgIC8vY29uc29sZS5sb2cobmV3VXJsKTtcclxuXHJcbiAgICByZXR1cm4gbmV3VXJsO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIE9wZXJhdGlvbmFsTGF5ZXIgPSB7XHJcbiAgb3BlcmF0aW9uYWxMYXllcjogb3BlcmF0aW9uYWxMYXllclxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgT3BlcmF0aW9uYWxMYXllcjsiLCIvKlxyXG4gKiBMLmVzcmkuV2ViTWFwXHJcbiAqIEEgbGVhZmxldCBwbHVnaW4gdG8gZGlzcGxheSBBcmNHSVMgV2ViIE1hcC4gaHR0cHM6Ly9naXRodWIuY29tL3ludW5va2F3YS9MLmVzcmkuV2ViTWFwXHJcbiAqIChjKSAyMDE2IFl1c3VrZSBOdW5va2F3YVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBgYGBqc1xyXG4gKiB2YXIgd2VibWFwID0gTC53ZWJtYXAoJzIyYzUwNGQyMjlmMTRjNzg5YzViNDllYmZmMzhiOTQxJywgeyBtYXA6IEwubWFwKCdtYXAnKSB9KTtcclxuICogYGBgXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gJy4uL3BhY2thZ2UuanNvbic7XHJcblxyXG5pbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuaW1wb3J0IHsgb3BlcmF0aW9uYWxMYXllciB9IGZyb20gJy4vT3BlcmF0aW9uYWxMYXllcic7XHJcblxyXG5leHBvcnQgdmFyIFdlYk1hcCA9IEwuRXZlbnRlZC5leHRlbmQoe1xyXG5cdG9wdGlvbnM6IHtcclxuICAgICAgICAvLyBMLk1hcFxyXG5cdFx0bWFwOiB7fSxcclxuICAgICAgICAvLyBhY2Nlc3MgdG9rZW4gZm9yIHNlY3VyZSBjb250ZW50cyBvbiBBcmNHSVMgT25saW5lXHJcbiAgICAgICAgdG9rZW46IG51bGxcclxuXHR9LFxyXG5cclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbih3ZWJtYXBJZCwgb3B0aW9ucykge1xyXG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuX21hcCA9IHRoaXMub3B0aW9ucy5tYXA7XHJcbiAgICAgICAgdGhpcy5fdG9rZW4gPSB0aGlzLm9wdGlvbnMudG9rZW47XHJcblx0XHR0aGlzLl93ZWJtYXBJZCA9IHdlYm1hcElkO1xyXG4gICAgICAgIHRoaXMuX2xvYWRlZCA9IGZhbHNlO1xyXG5cdFx0dGhpcy5fbWV0YWRhdGFMb2FkZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgdGhpcy5sYXllcnMgPSBbXTsgLy8gQ2hlY2sgdGhlIGxheWVyIHR5cGVzIGhlcmUgLT4gaHR0cHM6Ly9naXRodWIuY29tL3ludW5va2F3YS9MLmVzcmkuV2ViTWFwL3dpa2kvTGF5ZXItdHlwZXNcclxuICAgICAgICB0aGlzLnRpdGxlID0gJyc7IC8vIFdlYiBNYXAgVGl0bGVcclxuICAgICAgICB0aGlzLmJvb2ttYXJrcyA9IFtdOyAvLyBXZWIgTWFwIEJvb2ttYXJrcyAtPiBbeyBuYW1lOiAnQm9va21hcmsgbmFtZScsIGJvdW5kczogPEwubGF0TG5nQm91bmRzPiB9XVxyXG4gICAgICAgIHRoaXMucG9ydGFsSXRlbSA9IHt9OyAvLyBXZWIgTWFwIE1ldGFkYXRhXHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5WRVJTSU9OID0gdmVyc2lvbjtcclxuXHJcblx0XHR0aGlzLl9sb2FkV2ViTWFwTWV0YURhdGEod2VibWFwSWQpO1xyXG5cdFx0dGhpcy5fbG9hZFdlYk1hcCh3ZWJtYXBJZCk7XHJcblx0fSxcclxuXHJcblx0X2xvYWRXZWJNYXBNZXRhRGF0YTogZnVuY3Rpb24oaWQpIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKHRoaXMpO1xyXG4gICAgICAgIC8vY29uc29sZS5sb2codGhpcy5fdG9rZW4pO1xyXG5cdFx0dmFyIG1hcCA9IHRoaXMuX21hcDtcclxuXHRcdHZhciB3ZWJtYXAgPSB0aGlzO1xyXG5cdFx0dmFyIHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCA9ICdodHRwczovL3d3dy5hcmNnaXMuY29tL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZDtcclxuXHJcblx0XHRMLmVzcmkucmVxdWVzdCh3ZWJtYXBNZXRhRGF0YVJlcXVlc3RVcmwsIHt9LCBmdW5jdGlvbihlcnJvciwgcmVzcG9uc2Upe1xyXG5cdFx0ICBpZihlcnJvcil7XHJcblx0XHQgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG5cdFx0ICB9IGVsc2Uge1xyXG5cdFx0ICAgIGNvbnNvbGUubG9nKCdXZWJNYXAgTWV0YURhdGE6ICcsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnZXh0ZW50OiAnLCByZXNwb25zZS5leHRlbnQpO1xyXG4gICAgICAgICAgICB3ZWJtYXAucG9ydGFsSXRlbSA9IHJlc3BvbnNlO1xyXG4gICAgICAgICAgICB3ZWJtYXAudGl0bGUgPSByZXNwb25zZS50aXRsZTtcclxuICAgICAgICAgICAgd2VibWFwLl9tZXRhZGF0YUxvYWRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIHdlYm1hcC5maXJlKCdtZXRhZGF0YUxvYWQnKTtcclxuICAgICAgICAgICAgbWFwLmZpdEJvdW5kcyhbcmVzcG9uc2UuZXh0ZW50WzBdLnJldmVyc2UoKSwgcmVzcG9uc2UuZXh0ZW50WzFdLnJldmVyc2UoKV0pO1xyXG5cdFx0ICB9XHJcblx0XHR9KTtcclxuXHR9LFxyXG5cclxuXHRfbG9hZFdlYk1hcDogZnVuY3Rpb24oaWQpIHtcclxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXA7XHJcbiAgICAgICAgdmFyIGxheWVycyA9IHRoaXMubGF5ZXJzO1xyXG5cdFx0dmFyIGdlbmVyYXRlRXNyaUxheWVyID0gdGhpcy5fZ2VuZXJhdGVFc3JpTGF5ZXI7XHJcblx0XHR2YXIgd2VibWFwUmVxdWVzdFVybCA9ICdodHRwczovL3d3dy5hcmNnaXMuY29tL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZCArICcvZGF0YSc7XHJcblxyXG5cdFx0TC5lc3JpLnJlcXVlc3Qod2VibWFwUmVxdWVzdFVybCwge30sIGZ1bmN0aW9uKGVycm9yLCByZXNwb25zZSl7XHJcblx0XHQgIGlmKGVycm9yKXtcclxuXHRcdCAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcblx0XHQgIH0gZWxzZSB7XHJcblx0XHQgICAgY29uc29sZS5sb2coJ1dlYk1hcDogJywgcmVzcG9uc2UpO1xyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coJ2Jhc2VNYXA6ICcsIHJlc3BvbnNlLmJhc2VNYXApO1xyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coJ29wZXJhdGlvbmFsTGF5ZXJzOiAnLCByZXNwb25zZS5vcGVyYXRpb25hbExheWVycyk7XHJcblxyXG5cdFx0XHRcdC8vIEFkZCBCYXNlbWFwXHJcblx0XHRcdFx0cmVzcG9uc2UuYmFzZU1hcC5iYXNlTWFwTGF5ZXJzLm1hcChmdW5jdGlvbihiYXNlTWFwTGF5ZXIpIHtcclxuXHRcdFx0XHRcdHZhciBseXIgPSBvcGVyYXRpb25hbExheWVyKGJhc2VNYXBMYXllciwgbGF5ZXJzLCBtYXApLmFkZFRvKG1hcCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYobHlyICE9PSB1bmRlZmluZWQgJiYgYmFzZU1hcExheWVyLnZpc2liaWxpdHkgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbHlyLmFkZFRvKG1hcCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cdFx0XHRcdH0uYmluZCh0aGlzKSk7XHJcblxyXG5cdFx0XHRcdC8vIEFkZCBPcGVyYXRpb25hbCBMYXllcnNcclxuXHRcdFx0XHRyZXNwb25zZS5vcGVyYXRpb25hbExheWVycy5tYXAoZnVuY3Rpb24obGF5ZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbHlyID0gb3BlcmF0aW9uYWxMYXllcihsYXllciwgbGF5ZXJzLCBtYXApO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKGx5ciAhPT0gdW5kZWZpbmVkICYmIGxheWVyLnZpc2liaWxpdHkgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbHlyLmFkZFRvKG1hcCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cdFx0XHRcdH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQWRkIEJvb2ttYXJrc1xyXG4gICAgICAgICAgICAgICAgaWYocmVzcG9uc2UuYm9va21hcmtzICE9PSB1bmRlZmluZWQgJiYgcmVzcG9uc2UuYm9va21hcmtzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5ib29rbWFya3MubWFwKGZ1bmN0aW9uKGJvb2ttYXJrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVzcmkgRXh0ZW50IEdlb21ldHJ5IHRvIEwubGF0TG5nQm91bmRzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBub3J0aEVhc3QgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoYm9va21hcmsuZXh0ZW50LnhtYXgsIGJvb2ttYXJrLmV4dGVudC55bWF4KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzb3V0aFdlc3QgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoYm9va21hcmsuZXh0ZW50LnhtaW4sIGJvb2ttYXJrLmV4dGVudC55bWluKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBib3VuZHMgPSBMLmxhdExuZ0JvdW5kcyhzb3V0aFdlc3QsIG5vcnRoRWFzdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYm9va21hcmtzLnB1c2goeyBuYW1lOiBib29rbWFyay5uYW1lLCBib3VuZHM6IGJvdW5kcyB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuX2xvYWRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnKTtcclxuXHRcdCAgfVxyXG5cdFx0fS5iaW5kKHRoaXMpKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdlYk1hcCAod2VibWFwSWQsIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IFdlYk1hcCh3ZWJtYXBJZCwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHdlYk1hcDsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztDQUFPLFNBQVMsa0JBQWtCLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRTtBQUMzRCxDQUFBO0FBQ0EsQ0FBQSxJQUFJLElBQUksQ0FBQyxHQUFHLGVBQWUsQ0FBQztBQUM1QixDQUFBLElBQUksSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDO0FBQ3ZCLENBQUEsSUFBSSxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7O0FBRXJCLENBQUEsSUFBSSxJQUFJLFNBQVMsQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO0FBQ3ZDLENBQUEsUUFBUSxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQztBQUNwQyxDQUFBLEtBQUs7O0FBRUwsQ0FBQSxJQUFJLFNBQVMsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRTtBQUNqRCxDQUFBLFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixDQUFBLFFBQVEsT0FBTyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEMsQ0FBQSxLQUFLLENBQUMsQ0FBQzs7QUFF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