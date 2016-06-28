/* esri-leaflet-webmap - v0.3.0 - Tue Jun 28 2016 22:46:09 GMT+0900 (JST)
 * Copyright (c) 2016 Yusuke Nunokawa <nuno0825@gmail.com>
 * MIT */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet')) :
	typeof define === 'function' && define.amd ? define(['exports', 'leaflet'], factory) :
	(factory((global.L = global.L || {}, global.L.esri = global.L.esri || {}),global.L));
}(this, function (exports,L) { 'use strict';

	L = 'default' in L ? L['default'] : L;

	var version = "0.3.0";

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
	exports.createPopupContent = createPopupContent;
	exports.createLabelText = createLabelText;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9Qb3B1cC9Qb3B1cC5qcyIsIi4uL3NyYy9MYWJlbC9MYWJlbC5qcyIsIi4uL3NyYy9PcGVyYXRpb25hbExheWVyLmpzIiwiLi4vc3JjL1dlYk1hcExvYWRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gY3JlYXRlUG9wdXBDb250ZW50IChwb3B1cEluZm8sIHByb3BlcnRpZXMpIHtcbiAgICAvL2NvbnNvbGUubG9nKHBvcHVwSW5mbywgcHJvcGVydGllcyk7XG4gICAgdmFyIHIgPSAvXFx7KFteXFxdXSopXFx9L2c7XG4gICAgdmFyIHRpdGxlVGV4dCA9ICcnO1xuICAgIHZhciBjb250ZW50ID0gJyc7XG5cbiAgICBpZiAocG9wdXBJbmZvLnRpdGxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGl0bGVUZXh0ID0gcG9wdXBJbmZvLnRpdGxlO1xuICAgIH1cblxuICAgIHRpdGxlVGV4dCA9IHRpdGxlVGV4dC5yZXBsYWNlKHIsIGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgdmFyIG0gPSByLmV4ZWMocyk7XG4gICAgICAgIHJldHVybiBwcm9wZXJ0aWVzW21bMV1dO1xuICAgIH0pO1xuXG4gICAgY29udGVudCA9ICc8ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LXRpdGxlXCI+PGg0PicgKyB0aXRsZVRleHQgKyAnPC9oND48L2Rpdj48ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LWRlc2NyaXB0aW9uXCIgc3R5bGU9XCJtYXgtaGVpZ2h0OjIwMHB4O292ZXJmbG93OmF1dG87XCI+JztcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvcHVwSW5mby5maWVsZEluZm9zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS52aXNpYmxlID09PSB0cnVlKSB7XG4gICAgICAgICAgICBjb250ZW50ICs9ICc8ZGl2IHN0eWxlPVwiZm9udC13ZWlnaHQ6Ym9sZDtjb2xvcjojOTk5O21hcmdpbi10b3A6NXB4O3dvcmQtYnJlYWs6YnJlYWstYWxsO1wiPicgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbCArICc8L2Rpdj48cCBzdHlsZT1cIm1hcmdpbi10b3A6MDttYXJnaW4tYm90dG9tOjVweDt3b3JkLWJyZWFrOmJyZWFrLWFsbDtcIj4nICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdICsgJzwvcD4nO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29udGVudCArPSAnPC9kaXY+JztcblxuICAgIGlmIChwb3B1cEluZm8ubWVkaWFJbmZvcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIEl0IGRvZXMgbm90IHN1cHBvcnQgbWVkaWFJbmZvcyBmb3IgcG9wdXAgY29udGVudHMuXG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG59XG5cbmV4cG9ydCB2YXIgUG9wdXAgPSB7XG4gIGNyZWF0ZVBvcHVwQ29udGVudDogY3JlYXRlUG9wdXBDb250ZW50XG59O1xuXG5leHBvcnQgZGVmYXVsdCBQb3B1cDsiLCJleHBvcnQgZnVuY3Rpb24gY3JlYXRlTGFiZWxUZXh0IChwcm9wZXJ0aWVzLCBsYWJlbGluZ0luZm8pIHtcbiAgICAvL2NvbnNvbGUubG9nKCdnZW5lcmF0ZUxhYmVsczogJywgcHJvcGVydGllcywgbGFiZWxpbmdJbmZvKTtcbiAgICB2YXIgciA9IC9cXFsoW15cXF1dKilcXF0vZztcbiAgICB2YXIgbGFiZWxUZXh0ID0gbGFiZWxpbmdJbmZvWzBdLmxhYmVsRXhwcmVzc2lvbjtcblxuICAgIGxhYmVsVGV4dCA9IGxhYmVsVGV4dC5yZXBsYWNlKHIsIGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgdmFyIG0gPSByLmV4ZWMocyk7XG4gICAgICAgIC8vY29uc29sZS5sb2cobVsxXSk7XG4gICAgICAgIC8vY29uc29sZS5sb2cocHJvcGVydGllc1ttWzFdXSk7XG4gICAgICAgIHJldHVybiBwcm9wZXJ0aWVzW21bMV1dO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGxhYmVsVGV4dDtcbn1cblxuZXhwb3J0IHZhciBMYWJlbCA9IHtcbiAgY3JlYXRlTGFiZWxUZXh0OiBjcmVhdGVMYWJlbFRleHRcbn07XG5cbmV4cG9ydCBkZWZhdWx0IExhYmVsOyIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgY3JlYXRlUG9wdXBDb250ZW50IH0gZnJvbSAnLi9Qb3B1cC9Qb3B1cCc7XG5pbXBvcnQgeyBjcmVhdGVMYWJlbFRleHQgfSBmcm9tICcuL0xhYmVsL0xhYmVsJztcblxuZXhwb3J0IGZ1bmN0aW9uIG9wZXJhdGlvbmFsTGF5ZXIgKGxheWVyLCBsYXllcnMsIG1hcCkge1xuICByZXR1cm4gX2dlbmVyYXRlRXNyaUxheWVyKGxheWVyLCBsYXllcnMsIG1hcCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZ2VuZXJhdGVFc3JpTGF5ZXIgKGxheWVyLCBsYXllcnMsIG1hcCkge1xuICAgIGNvbnNvbGUubG9nKCdnZW5lcmF0ZUVzcmlMYXllcjogJywgbGF5ZXIudGl0bGUsIGxheWVyKTtcblxuICAgIGlmKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gU3VwcG9ydGluZyBvbmx5IHBvaW50IGdlb21ldHJ5XG4gICAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGUgRmVhdHVyZUNvbGxlY3Rpb24nKTtcbiAgICAgICAgdmFyIHJlbmRlcmVyID0gbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzWzBdLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlcjtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyZW5kZXJlcik7XG4gICAgICAgIHZhciBmZWF0dXJlcyA9IFtdO1xuICAgICAgICB2YXIgbGFiZWxzID0gW107XG5cbiAgICAgICAgbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzWzBdLmZlYXR1cmVTZXQuZmVhdHVyZXMubWFwKGZ1bmN0aW9uKGZlYXR1cmUpIHtcblxuICAgICAgICAgICAgdmFyIGljb24gPSBfZ2VuZXJhdGVJY29uKHJlbmRlcmVyLCBmZWF0dXJlLmF0dHJpYnV0ZXMpO1xuICAgICAgICAgICAgdmFyIG1lcmNhdG9yVG9MYXRsbmcgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoZmVhdHVyZS5nZW9tZXRyeS54LCBmZWF0dXJlLmdlb21ldHJ5LnkpKTtcblxuICAgICAgICAgICAgdmFyIGYgPSBMLm1hcmtlcihtZXJjYXRvclRvTGF0bG5nLCB7IGljb246IGljb24sIG9wYWNpdHk6IGxheWVyLm9wYWNpdHkgfSk7XG5cbiAgICAgICAgICAgIGlmKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQobGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzWzBdLnBvcHVwSW5mbywgZmVhdHVyZS5hdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgICAgICBmLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbMF0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxhYmVsaW5nSW5mbyA9IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1swXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xuICAgICAgICAgICAgICAgIHZhciBsYWJlbFRleHQgPSBjcmVhdGVMYWJlbFRleHQoZmVhdHVyZS5hdHRyaWJ1dGVzLCBsYWJlbGluZ0luZm8pO1xuICAgICAgICAgICAgICAgICAgICAvLyB3aXRoIExlYWZsZXQubGFiZWxcbiAgICAgICAgICAgICAgICAgICAgLy9mLmJpbmRMYWJlbChsYWJlbFRleHQsIHsgbm9IaWRlOiB0cnVlIH0pLnNob3dMYWJlbCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdpdGhvdXQgTGVhZmxldC5sYWJlbFxuICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWwgPSBMLm1hcmtlcihtZXJjYXRvclRvTGF0bG5nLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXG4gICAgICAgICAgICAgICAgICAgIGljb246IEwuZGl2SWNvbih7XG4gICAgICAgICAgICAgICAgICAgIGljb25TaXplOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU6ICdwb2ludC1sYWJlbCcsXG4gICAgICAgICAgICAgICAgICAgIGh0bWw6ICc8ZGl2PicgKyBsYWJlbFRleHQgKyAnPC9kaXY+J1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmZWF0dXJlcy5wdXNoKGYpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgbHlyID0gTC5mZWF0dXJlR3JvdXAoZmVhdHVyZXMpO1xuXG4gICAgICAgIGlmKGxhYmVscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB2YXIgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xuICAgICAgICAgICAgbHlyID0gTC5sYXllckdyb3VwKFtseXIsIGxhYmVsc0xheWVyXSk7XG4gICAgICAgIH1cblxuICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGQycsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcblxuICAgICAgICByZXR1cm4gbHlyO1xuICAgIH1cbiAgICBlbHNlIGlmKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU0ZlYXR1cmVMYXllcicgJiYgbGF5ZXIubGF5ZXJEZWZpbml0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvICE9PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgaWYobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLnR5cGUgPT09ICdoZWF0bWFwJyl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2NyZWF0ZSBIZWF0bWFwTGF5ZXInKTtcbiAgICAgICAgICAgICAgICB2YXIgZ3JhZGllbnQgPSB7fTtcblxuICAgICAgICAgICAgICAgIGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5jb2xvclN0b3BzLm1hcChmdW5jdGlvbihzdG9wKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhZGllbnRbc3RvcC5yYXRpb10gPSAncmdiYSgnICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJywnICsgKHN0b3AuY29sb3JbM10vMjU1KSArICcpJztcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFkaWVudFtNYXRoLnJvdW5kKHN0b3AucmF0aW8qMTAwKS8xMDBdID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xuICAgICAgICAgICAgICAgICAgICBncmFkaWVudFsoTWF0aC5yb3VuZChzdG9wLnJhdGlvKjEwMCkvMTAwKzYpLzddID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyKTtcblxuICAgICAgICAgICAgICAgIHZhciBseXIgPSBMLmVzcmkuSGVhdC5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDIuMFxuICAgICAgICAgICAgICAgIC8vdmFyIGx5ciA9IEwuZXNyaS5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDEuMFxuICAgICAgICAgICAgICAgICAgICB1cmw6IGxheWVyLnVybCxcbiAgICAgICAgICAgICAgICAgICAgbWluT3BhY2l0eTogMC41LFxuICAgICAgICAgICAgICAgICAgICBtYXg6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5tYXhQaXhlbEludGVuc2l0eSxcbiAgICAgICAgICAgICAgICAgICAgYmx1cjogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLmJsdXJSYWRpdXMsXG4gICAgICAgICAgICAgICAgICAgIHJhZGl1czogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLmJsdXJSYWRpdXMgKiAxLjMsXG4gICAgICAgICAgICAgICAgICAgIGdyYWRpZW50OiBncmFkaWVudFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnSEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbHlyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNGZWF0dXJlTGF5ZXIgKHdpdGggbGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvKScpO1xuICAgICAgICAgICAgICAgIHZhciByZW5kZXJlciA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlcjtcbiAgICAgICAgICAgICAgICB2YXIgd2hlcmUgPSAnMT0xJztcblxuICAgICAgICAgICAgICAgIGlmKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHdoZXJlID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBsYWJlbHMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xuICAgICAgICAgICAgICAgIHZhciBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcbiAgICAgICAgICAgICAgICAgICAgdXJsOiBsYXllci51cmwsXG4gICAgICAgICAgICAgICAgICAgIHdoZXJlOiB3aGVyZSxcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlUmVuZGVyZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHBvaW50VG9MYXllcjogZnVuY3Rpb24gKGdlb2pzb24sIGxhdGxuZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhnZW9qc29uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpY29uID0gX2dlbmVyYXRlSWNvbihyZW5kZXJlciwgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGYgPSBMLm1hcmtlcihsYXRsbmcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uOiBpY29uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZjtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU6IGZ1bmN0aW9uIChnZW9qc29uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcGF0aE9wdGlvbnM7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGdlb2pzb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZ2VvanNvbi5nZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycgfHwgZ2VvanNvbi5nZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJyB8fCBnZW9qc29uLmdlb21ldHJ5LnR5cGUgPT09ICdQb2x5Z29uJyB8fCBnZW9qc29uLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aE9wdGlvbnMgPSBfZ2VuZXJhdGVQYXRoU3R5bGUocmVuZGVyZXIsIGdlb2pzb24ucHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGdlb2pzb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGF0aE9wdGlvbnM7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihsYXllci5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQobGF5ZXIucG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWxpbmdJbmZvID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWxUZXh0ID0gY3JlYXRlTGFiZWxUZXh0KGdlb2pzb24ucHJvcGVydGllcywgbGFiZWxpbmdJbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGxhYmVsVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCBMZWFmbGV0LmxhYmVsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9mLmJpbmRMYWJlbChsYWJlbFRleHQsIHsgbm9IaWRlOiB0cnVlIH0pLnNob3dMYWJlbCgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhnZW9qc29uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsYWJlbFBvcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWxDbGFzc05hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWxQb3MgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXMucmV2ZXJzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbENsYXNzTmFtZSA9ICdwb2ludC1sYWJlbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2VudHJhbEtleSA9IE1hdGgucm91bmQoYy5sZW5ndGgvMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coY1tjZW50cmFsS2V5XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gY1tjZW50cmFsS2V5XS5yZXZlcnNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsQ2xhc3NOYW1lID0gJ3BhdGgtbGFiZWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLy5sb2cobC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjZW50cmFsS2V5ID0gTWF0aC5yb3VuZChjLmxlbmd0aC8yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGMyID0gY1tjZW50cmFsS2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGMyLmxlbmd0aC8yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhjMltjZW50cmFsS2V5XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gYzJbY2VudHJhbEtleV0ucmV2ZXJzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbENsYXNzTmFtZSA9ICdwYXRoLWxhYmVsJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gbC5nZXRCb3VuZHMoKS5nZXRDZW50ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhsYWJlbFBvcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsQ2xhc3NOYW1lID0gJ3BhdGgtbGFiZWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3aXRob3V0IExlYWZsZXQubGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWwgPSBMLm1hcmtlcihsYWJlbFBvcywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGljb246IEwuZGl2SWNvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uU2l6ZTogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogbGFiZWxDbGFzc05hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBodG1sOiAnPGRpdj4nICsgbGFiZWxUZXh0ICsgJzwvZGl2PidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsc0xheWVyLmFkZExheWVyKGxhYmVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgbHlyID0gTC5sYXllckdyb3VwKFtseXIsIGxhYmVsc0xheWVyXSk7XG5cbiAgICAgICAgICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBseXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllciAod2l0aG91dCBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8pJyk7XG4gICAgICAgICAgICB2YXIgd2hlcmUgPSAnMT0xJztcblxuICAgICAgICAgICAgaWYobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB3aGVyZSA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGx5ciA9IEwuZXNyaS5mZWF0dXJlTGF5ZXIoe1xuICAgICAgICAgICAgICAgIHVybDogbGF5ZXIudXJsLFxuICAgICAgICAgICAgICAgIHdoZXJlOiB3aGVyZSxcbiAgICAgICAgICAgICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xuICAgICAgICAgICAgICAgICAgICBpZihsYXllci5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8qbHlyLm1ldGFkYXRhKGZ1bmN0aW9uKGVycm9yLCByZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbihlcnJvcikgeyBjb25zb2xlLmxvZyhlcnJvcik7IH0pOyovXG5cbiAgICAgICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbHlyO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTRmVhdHVyZUxheWVyJykge1xuICAgICAgICBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllcicpO1xuICAgICAgICB2YXIgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XG4gICAgICAgICAgICB1cmw6IGxheWVyLnVybCxcbiAgICAgICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XG4gICAgICAgICAgICAgICAgaWYobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgICAgIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvaW50VG9MYXllcjogZnVuY3Rpb24gKGdlb2pzb24sIGxhdGxuZykge1xuXG4gICAgICAgICAgICAgICAgdmFyIGYgPSBMLm1hcmtlcihsYXRsbmcsIHtcbiAgICAgICAgICAgICAgICAgICAgLy9pY29uOiBpY29uLFxuICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLypseXIubWV0YWRhdGEoZnVuY3Rpb24oZXJyb3IsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvciwgcmVzcG9uc2UpO1xuICAgICAgICB9LCBmdW5jdGlvbihlcnJvcikgeyBjb25zb2xlLmxvZyhlcnJvcik7IH0pOyovXG5cbiAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRkwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XG5cbiAgICAgICAgcmV0dXJuIGx5cjtcbiAgICB9XG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNJbWFnZVNlcnZpY2VMYXllcicpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNJbWFnZVNlcnZpY2VMYXllcicpO1xuICAgICAgICB2YXIgbHlyID0gTC5lc3JpLmltYWdlTWFwTGF5ZXIoe1xuICAgICAgICAgICAgdXJsOiBsYXllci51cmxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnSU1MJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xuXG4gICAgICAgIHJldHVybiBseXI7XG4gICAgfVxuICAgIGVsc2UgaWYobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTTWFwU2VydmljZUxheWVyJykge1xuICAgICAgICB2YXIgbHlyID0gTC5lc3JpLmR5bmFtaWNNYXBMYXllcih7XG4gICAgICAgICAgICB1cmw6IGxheWVyLnVybFxuICAgICAgICB9KTtcblxuICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdETUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XG5cbiAgICAgICAgcmV0dXJuIGx5cjtcbiAgICB9XG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNUaWxlZE1hcFNlcnZpY2VMYXllcicpIHtcbiAgICB0cnkge1xuICAgIHZhciBseXIgPSBMLmVzcmkuYmFzZW1hcExheWVyKGxheWVyLnRpdGxlKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICB2YXIgbHlyID0gTC5lc3JpLnRpbGVkTWFwTGF5ZXIoe1xuICAgICAgICAgICAgdXJsOiBsYXllci51cmxcbiAgICAgICAgfSk7XG5cbiAgICBMLmVzcmkucmVxdWVzdChsYXllci51cmwsIHt9LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgdmFyIG1heFdpZHRoID0gKG1hcC5nZXRTaXplKCkueCAtIDU1KTtcbiAgICAgICAgdmFyIHRpbGVkQXR0cmlidXRpb24gPSAnPHNwYW4gY2xhc3M9XCJlc3JpLWF0dHJpYnV0aW9uc1wiIHN0eWxlPVwibGluZS1oZWlnaHQ6MTRweDsgdmVydGljYWwtYWxpZ246IC0zcHg7IHRleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7IHdoaXRlLXNwYWNlOm5vd3JhcDsgb3ZlcmZsb3c6aGlkZGVuOyBkaXNwbGF5OmlubGluZS1ibG9jazsgbWF4LXdpZHRoOicgKyBtYXhXaWR0aCArICdweDtcIj4nICsgcmVzLmNvcHlyaWdodFRleHQgKyAnPC9zcGFuPidcbiAgICAgICAgbWFwLmF0dHJpYnV0aW9uQ29udHJvbC5hZGRBdHRyaWJ1dGlvbih0aWxlZEF0dHJpYnV0aW9uKTtcbiAgICB9KTtcbiAgICB9XG5cbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdUTUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XG4gICAgcmV0dXJuIGx5cjtcblxuICAgIH1cbiAgICBlbHNlIGlmKGxheWVyLmxheWVyVHlwZSA9PT0gJ09wZW5TdHJlZXRNYXAnKSB7XG4gICAgICAgIHZhciBseXIgPSBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICAgICAgICAgICAgYXR0cmlidXRpb246ICcmY29weTsgPGEgaHJlZj1cImh0dHA6Ly9vc20ub3JnL2NvcHlyaWdodFwiPk9wZW5TdHJlZXRNYXA8L2E+IGNvbnRyaWJ1dG9ycydcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XG5cbiAgICAgICAgcmV0dXJuIGx5cjtcbiAgICB9XG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICdXZWJUaWxlZExheWVyJykge1xuICAgICAgICB2YXIgbHlyVXJsID0gX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldChsYXllci50ZW1wbGF0ZVVybCk7XG4gICAgICAgIHZhciBseXIgPSBMLnRpbGVMYXllcihseXJVcmwsIHtcbiAgICAgICAgICAgIGF0dHJpYnV0aW9uOiBsYXllci5jb3B5cmlnaHRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XG5cbiAgICAgICAgcmV0dXJuIGx5cjtcbiAgICB9XG4gICAgZWxzZSBpZihsYXllci5sYXllclR5cGUgPT09ICcnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBseXIgPSBMLmZlYXR1cmVHcm91cChbXSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdVbnN1cHBvcnRlZCBMYXllcjogJywgbGF5ZXIpO1xuICAgICAgICByZXR1cm4gbHlyO1xuICAgIH1cbn1cblxuXG4vLyBpIHdpbGwgZHVwbGljYXRlIHRoZSBiZWxvdyBmdW5jdGlvbnNcbi8vIGFuZCByZXBsYWNlIGVzcmktbGVhZmxldC1yZW5kZXJlcnMuXG5leHBvcnQgZnVuY3Rpb24gX3BvaW50U3ltYm9sIChzeW1ib2wpIHtcbiAgICB2YXIgaWNvbjtcblxuICAgICAgICBpZihzeW1ib2wudHlwZSA9PT0gJ2VzcmlQTVMnKSB7XG4gICAgICAgICAgICB2YXIgaWNvblVybCA9IHN5bWJvbC51cmw7XG5cbiAgICAgICAgICAgIGlmKHN5bWJvbC5pbWFnZURhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGljb25VcmwgPSAnZGF0YTonICsgc3ltYm9sLmNvbnRlbnRUeXBlICsgJztiYXNlNjQsJyArIHN5bWJvbC5pbWFnZURhdGE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGljb24gPSBMLmljb24oe1xuICAgICAgICAgICAgICAgIGljb25Vcmw6IGljb25VcmwsXG4gICAgICAgICAgICAgICAgc2hhZG93VXJsOiAnJyxcbiAgICAgICAgICAgICAgICBpY29uU2l6ZTogICAgIFsoc3ltYm9sLmhlaWdodCo0LzMpLCAoc3ltYm9sLndpZHRoKjQvMyldLFxuICAgICAgICAgICAgICAgIHNoYWRvd1NpemU6ICAgWzAsIDBdLFxuICAgICAgICAgICAgICAgIGljb25BbmNob3I6ICAgWyhzeW1ib2wuaGVpZ2h0KjQvMyktMTYsIChzeW1ib2wud2lkdGgqNC8zKS0xXSxcbiAgICAgICAgICAgICAgICBzaGFkb3dBbmNob3I6IFswLCAwXSxcbiAgICAgICAgICAgICAgICBwb3B1cEFuY2hvcjogIFsoc3ltYm9sLndpZHRoKjQvMykvMywgKHN5bWJvbC5oZWlnaHQqNC8zKSotMV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmKHN5bWJvbC50eXBlID09PSAnZXNyaVNNUycpIHtcbiAgICAgICAgICAgIGlmKHN5bWJvbC5zdHlsZSA9PT0gJ2VzcmlTTVNDaXJjbGUnKSB7XG4gICAgICAgICAgICAgICAgaWYoc3ltYm9sLm91dGxpbmUuc3R5bGUgPT09ICdlc3JpU0xTTnVsbCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWNvbiA9IEwudmVjdG9ySWNvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NsYXNzTmFtZTogJ215LXZlY3Rvci1pY29uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z0hlaWdodDogKChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3ZnV2lkdGg6ICgoc3ltYm9sLnNpemUqNC8zKS8yICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMykpICogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaXJjbGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2hhcGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByOiAoc3ltYm9sLnNpemUqNC8zKS8yICsgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3g6IChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeTogKHN5bWJvbC5zaXplKjQvMykvMiArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxsOiAncmdiYSgnICsgc3ltYm9sLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLmNvbG9yWzJdICsgJywnICsgc3ltYm9sLmNvbG9yWzNdLzI1NSArICcpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3N0cm9rZTogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlV2lkdGg6IDBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpY29uID0gTC52ZWN0b3JJY29uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xhc3NOYW1lOiAnbXktdmVjdG9yLWljb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3ZnSGVpZ2h0OiAoKHN5bWJvbC5zaXplKjQvMykvMiArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpKSAqIDIsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdXaWR0aDogKChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NpcmNsZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFwZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHI6IChzeW1ib2wuc2l6ZSo0LzMpLzIgKyAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeDogKHN5bWJvbC5zaXplKjQvMykvMiArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN5OiAoc3ltYm9sLnNpemUqNC8zKS8yICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGw6ICdyZ2JhKCcgKyBzeW1ib2wuY29sb3JbMF0gKyAnLCcgKyBzeW1ib2wuY29sb3JbMV0gKyAnLCcgKyBzeW1ib2wuY29sb3JbMl0gKyAnLCcgKyBzeW1ib2wuY29sb3JbM10vMjU1ICsgJyknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZTogJ3JnYmEoJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLm91dGxpbmUuY29sb3JbMV0gKyAnLCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclsyXSArICcsJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzNdLzI1NSArICcpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2VXaWR0aDogKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZihzeW1ib2wuc3R5bGUgPT09ICdlc3JpU01TU3F1YXJlJykge1xuICAgICAgICAgICAgICAgIGlmKHN5bWJvbC5vdXRsaW5lLnN0eWxlID09PSAnZXNyaVNMU051bGwnKSB7XG4gICAgICAgICAgICAgICAgICAgIGljb24gPSBMLnZlY3Rvckljb24oe1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9jbGFzc05hbWU6ICdteS12ZWN0b3ItaWNvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdIZWlnaHQ6IChzeW1ib2wuc2l6ZSo0LzMpICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMykgKiAyICsgMixcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z1dpZHRoOiAoc3ltYm9sLnNpemUqNC8zKSArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpICogMiArIDIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFwZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6ICcxJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB5OiAnMScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IChzeW1ib2wuc2l6ZSo0LzMpICsgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAoc3ltYm9sLnNpemUqNC8zKSArICcnXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxsOiAncmdiYSgnICsgc3ltYm9sLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLmNvbG9yWzJdICsgJywnICsgc3ltYm9sLmNvbG9yWzNdLzI1NSArICcpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3N0cm9rZTogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlV2lkdGg6IDBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpY29uID0gTC52ZWN0b3JJY29uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xhc3NOYW1lOiAnbXktdmVjdG9yLWljb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3ZnSGVpZ2h0OiAoc3ltYm9sLnNpemUqNC8zKSArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpICogMiArIDIsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdmdXaWR0aDogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSAqIDIgKyAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2hhcGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4OiAnMScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeTogJzEnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAoc3ltYm9sLnNpemUqNC8zKSArICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogKHN5bWJvbC5zaXplKjQvMykgKyAnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbDogJ3JnYmEoJyArIHN5bWJvbC5jb2xvclswXSArICcsJyArIHN5bWJvbC5jb2xvclsxXSArICcsJyArIHN5bWJvbC5jb2xvclsyXSArICcsJyArIHN5bWJvbC5jb2xvclszXS8yNTUgKyAnKScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlOiAncmdiYSgnICsgc3ltYm9sLm91dGxpbmUuY29sb3JbMF0gKyAnLCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclsxXSArICcsJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzJdICsgJywnICsgc3ltYm9sLm91dGxpbmUuY29sb3JbM10vMjU1ICsgJyknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZVdpZHRoOiAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKmVsc2UgaWYoc3ltYm9sLnN0eWxlID09PSAnZXNyaVNNU0RpYW1vbmQnKSB7XG4gICAgICAgICAgICAgICAgaWYoc3ltYm9sLm91dGxpbmUuc3R5bGUgPT09ICdlc3JpU0xTTnVsbCcpIHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0qL1xuICAgICAgICAgICAgZWxzZSBpZihzeW1ib2wuc3R5bGUgPT09ICcnKSB7XG4gICAgICAgICAgICAgICAgaWYoc3ltYm9sLm91dGxpbmUuc3R5bGUgPT09ICdlc3JpU0xTTnVsbCcpIHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE90aGVyIFNNU3MgLT4gQ2lyY2xlXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZihzeW1ib2wub3V0bGluZS5zdHlsZSA9PT0gJ2VzcmlTTFNOdWxsJykge1xuICAgICAgICAgICAgICAgICAgICBpY29uID0gTC52ZWN0b3JJY29uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xhc3NOYW1lOiAnbXktdmVjdG9yLWljb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3ZnSGVpZ2h0OiAoKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3ZnV2lkdGg6ICgoc3ltYm9sLnNpemUqNC8zKSArIChzeW1ib2wub3V0bGluZS53aWR0aCo0LzMpKSAqIDIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY2lyY2xlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYXBlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcjogKHN5bWJvbC5zaXplKjQvMykgKyAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeDogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjeTogKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbDogJ3JnYmEoJyArIHN5bWJvbC5jb2xvclswXSArICcsJyArIHN5bWJvbC5jb2xvclsxXSArICcsJyArIHN5bWJvbC5jb2xvclsyXSArICcsJyArIHN5bWJvbC5jb2xvclszXS8yNTUgKyAnKScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9zdHJva2U6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZVdpZHRoOiAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWNvbiA9IEwudmVjdG9ySWNvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NsYXNzTmFtZTogJ215LXZlY3Rvci1pY29uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z0hlaWdodDogKChzeW1ib2wuc2l6ZSo0LzMpICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMykpICogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIHN2Z1dpZHRoOiAoKHN5bWJvbC5zaXplKjQvMykgKyAoc3ltYm9sLm91dGxpbmUud2lkdGgqNC8zKSkgKiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NpcmNsZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFwZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHI6IChzeW1ib2wuc2l6ZSo0LzMpICsgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3g6IChzeW1ib2wuc2l6ZSo0LzMpICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3k6IChzeW1ib2wuc2l6ZSo0LzMpICsgKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGw6ICdyZ2JhKCcgKyBzeW1ib2wuY29sb3JbMF0gKyAnLCcgKyBzeW1ib2wuY29sb3JbMV0gKyAnLCcgKyBzeW1ib2wuY29sb3JbMl0gKyAnLCcgKyBzeW1ib2wuY29sb3JbM10vMjU1ICsgJyknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZTogJ3JnYmEoJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLm91dGxpbmUuY29sb3JbMV0gKyAnLCcgKyBzeW1ib2wub3V0bGluZS5jb2xvclsyXSArICcsJyArIHN5bWJvbC5vdXRsaW5lLmNvbG9yWzNdLzI1NSArICcpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2VXaWR0aDogKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGljb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfcGF0aFN5bWJvbCAoc3ltYm9sKSB7XG4gICAgdmFyIHN0eWxlO1xuXG4gICAgaWYoc3ltYm9sLnN0eWxlID09PSAnZXNyaVNMU1NvbGlkJykge1xuICAgICAgICBzdHlsZSA9IHtcbiAgICAgICAgICAgIGNvbG9yOiAncmdiYSgnICsgc3ltYm9sLmNvbG9yWzBdICsgJywnICsgc3ltYm9sLmNvbG9yWzFdICsgJywnICsgc3ltYm9sLmNvbG9yWzJdICsgJywnICsgc3ltYm9sLmNvbG9yWzNdLzI1NSArICcpJyxcbiAgICAgICAgICAgIHdlaWdodDogKHN5bWJvbC5zaXplKjQvMykgfHwgKHN5bWJvbC53aWR0aCo0LzMpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZihzeW1ib2wuc3R5bGUgPT09ICdlc3JpU0ZTU29saWQnKSB7XG4gICAgICAgIHZhciBjb2xvciA9IHN5bWJvbC5jb2xvclxuICAgICAgICB2YXIgb3V0bGluZUNvbG9yID0gc3ltYm9sLm91dGxpbmUuY29sb3I7XG5cbiAgICAgICAgaWYoc3ltYm9sLmNvbG9yID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb2xvciA9IFswLDAsMCwwXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHN5bWJvbC5vdXRsaW5lLmNvbG9yID09PSBudWxsKSB7XG4gICAgICAgICAgICBvdXRsaW5lQ29sb3IgPSBbMCwwLDAsMF07XG4gICAgICAgIH1cblxuICAgICAgICBzdHlsZSA9IHtcbiAgICAgICAgICAgIGZpbGxDb2xvcjogJ3JnYignICsgY29sb3JbMF0gKyAnLCcgKyBjb2xvclsxXSArICcsJyArIGNvbG9yWzJdICsgJyknLFxuICAgICAgICAgICAgZmlsbE9wYWNpdHk6IGNvbG9yWzNdLzI1NSxcbiAgICAgICAgICAgIGNvbG9yOiAncmdiYSgnICsgb3V0bGluZUNvbG9yWzBdICsgJywnICsgb3V0bGluZUNvbG9yWzFdICsgJywnICsgb3V0bGluZUNvbG9yWzJdICsgJywnICsgb3V0bGluZUNvbG9yWzNdLzI1NSArICcpJyxcbiAgICAgICAgICAgIHdlaWdodDogKHN5bWJvbC5vdXRsaW5lLndpZHRoKjQvMylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdHlsZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9jYWxWaXN1YWxWYXJpYWJsZXMgKHN5bWJvbCwgdmlzdWFsVmFyaWFibGVzLCBwcm9wZXJ0aWVzKSB7XG4gICAgdmFyIHZ2U3ltYm9sID0gc3ltYm9sO1xuICAgIC8vdmFyIHZhbHVlID0gcHJvcGVydGllc1t2aXN1YWxWYXJpYWJsZXNbMF0uZmllbGRdO1xuXG4gICAgdmlzdWFsVmFyaWFibGVzLm1hcChmdW5jdGlvbiAodnYpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcHJvcGVydGllc1t2di5maWVsZF07XG5cbiAgICAgICAgaWYodnYudHlwZSA9PT0gJ3NpemVJbmZvJykge1xuICAgICAgICAgICAgdmFyIHJhdGUgPSAodmFsdWUgLSB2di5taW5EYXRhVmFsdWUpLyh2di5tYXhEYXRhVmFsdWUgLSB2di5taW5EYXRhVmFsdWUpO1xuICAgICAgICAgICAgdmFyIHN1Ym1pdFNpemUgPSAocmF0ZSAqICh2di5tYXhTaXplIC0gdnYubWluU2l6ZSkpICsgdnYubWluU2l6ZTtcbiAgICAgICAgICAgIHZ2U3ltYm9sLnNpemUgPSBzdWJtaXRTaXplO1xuICAgICAgICAgICAgaWYodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB2dlN5bWJvbC5zaXplID0gNjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKHZ2LnR5cGUgPT09ICdjb2xvckluZm8nKSB7XG4gICAgICAgICAgICAvLyBDb2xvciBSYW1wXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKHN5bWJvbC5jb2xvcik7XG4gICAgICAgICAgICB2YXIgc3RvcHMgPSB2di5zdG9wcztcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2codnYuc3RvcHMpO1xuICAgICAgICAgICAgc3RvcHMubWFwKGZ1bmN0aW9uKHN0b3AsIGkpIHtcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdiYXNlIGNvbG9yOiAnLCBzdG9wLmNvbG9yKTtcbiAgICAgICAgICAgICAgICBpZihpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKHN0b3AudmFsdWUgPiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN1Ym1pdENvbG9yID0gc3RvcC5jb2xvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZ2U3ltYm9sLmNvbG9yID0gc3VibWl0Q29sb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdtaW46ICcsIHZ2U3ltYm9sLmNvbG9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmKGkgPT09IHN0b3BzLmxlbmd0aC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKHN0b3AudmFsdWUgPD0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdWJtaXRDb2xvciA9IHN0b3AuY29sb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICB2dlN5bWJvbC5jb2xvciA9IHN1Ym1pdENvbG9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnbWF4OiAnLCB2dlN5bWJvbC5jb2xvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKHN0b3AudmFsdWUgPiB2YWx1ZSAmJiBzdG9wc1tpLTFdLnZhbHVlIDw9IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3VibWl0Q29sb3IgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByYXRlID0gKHZhbHVlIC0gc3RvcHNbaS0xXS52YWx1ZSkvKHN0b3AudmFsdWUgLSBzdG9wc1tpLTFdLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZ2U3ltYm9sLmNvbG9yLm1hcChmdW5jdGlvbihjb2xvciwgaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1Ym1pdENvbG9yW2pdID0gTWF0aC5yb3VuZCgocmF0ZSAqIChzdG9wLmNvbG9yW2pdIC0gc3RvcHNbaS0xXS5jb2xvcltqXSkpICsgc3RvcHNbaS0xXS5jb2xvcltqXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZ2U3ltYm9sLmNvbG9yID0gc3VibWl0Q29sb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKHZ2U3ltYm9sLmNvbG9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdnZTeW1ib2w7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZ2VuZXJhdGVQYXRoU3R5bGUgKHJlbmRlcmVyLCBwcm9wZXJ0aWVzKSB7XG4gICAgdmFyIHN0eWxlID0ge307XG5cbiAgICBpZihyZW5kZXJlci50eXBlID09PSAnc2ltcGxlJykge1xuICAgICAgICBzdHlsZSA9IF9wYXRoU3ltYm9sKHJlbmRlcmVyLnN5bWJvbCk7XG4gICAgfVxuXG4gICAgaWYocmVuZGVyZXIudHlwZSA9PT0gJ3VuaXF1ZVZhbHVlJykge1xuICAgICAgICByZW5kZXJlci51bmlxdWVWYWx1ZUluZm9zLm1hcChmdW5jdGlvbihpbmZvKSB7XG4gICAgICAgICAgICBpZihpbmZvLnZhbHVlID09PSBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkMV0pIHsgLy8gZmllbGQyLCBmaWVsZDPjga/lvozjgafogIPjgYjjgojjgYZcbiAgICAgICAgICAgICAgICB2YXIgc3ltYm9sID0gaW5mby5zeW1ib2w7XG4gICAgICAgICAgICAgICAgaWYocmVuZGVyZXIudmlzdWFsVmFyaWFibGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sID0gX2NhbFZpc3VhbFZhcmlhYmxlcyhpbmZvLnN5bWJvbCwgcmVuZGVyZXIudmlzdWFsVmFyaWFibGVzLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3R5bGUgPSBfcGF0aFN5bWJvbChzeW1ib2wpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZihyZW5kZXJlci50eXBlID09PSAnY2xhc3NCcmVha3MnKSB7XG4gICAgICAgIHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvcy5tYXAoZnVuY3Rpb24oaW5mbywgaSkge1xuICAgICAgICAgICAgdmFyIHByZXZJbmZvO1xuICAgICAgICAgICAgdmFyIHN5bWJvbCA9IGluZm8uc3ltYm9sO1xuXG4gICAgICAgICAgICBpZihpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcHJldkluZm8gPSByZW5kZXJlci5taW5WYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHByZXZJbmZvID0gcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zW2ktMV0uY2xhc3NNYXhWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coaW5mby5jbGFzc01heFZhbHVlLCBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSwgcHJldkluZm8pO1xuXG4gICAgICAgICAgICBpZihyZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MubGVuZ3RoID09PSAoaSsxKSkge1xuICAgICAgICAgICAgICAgIGlmKGluZm8uY2xhc3NNYXhWYWx1ZSA+PSBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSAmJiBwcmV2SW5mbyA8PSBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSkge1xuICAgICAgICAgICAgICAgICAgICBpZihyZW5kZXJlci52aXN1YWxWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ltYm9sID0gX2NhbFZpc3VhbFZhcmlhYmxlcyhpbmZvLnN5bWJvbCwgcmVuZGVyZXIudmlzdWFsVmFyaWFibGVzLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzdHlsZSA9IF9wYXRoU3ltYm9sKGluZm8uc3ltYm9sKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZihpbmZvLmNsYXNzTWF4VmFsdWUgPiBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSAmJiBwcmV2SW5mbyA8PSBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkXSkge1xuICAgICAgICAgICAgICAgICAgICBpZihyZW5kZXJlci52aXN1YWxWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ltYm9sID0gX2NhbFZpc3VhbFZhcmlhYmxlcyhpbmZvLnN5bWJvbCwgcmVuZGVyZXIudmlzdWFsVmFyaWFibGVzLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzdHlsZSA9IF9wYXRoU3ltYm9sKGluZm8uc3ltYm9sKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBzdHlsZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9nZW5lcmF0ZUljb24gKHJlbmRlcmVyLCBwcm9wZXJ0aWVzKSB7XG4gICAgLy9jb25zb2xlLmxvZyhyZW5kZXJlcik7XG4gICAgdmFyIGljb247XG5cbiAgICBpZihyZW5kZXJlci50eXBlID09PSAnc2ltcGxlJykge1xuICAgICAgICBpY29uID0gX3BvaW50U3ltYm9sKHJlbmRlcmVyLnN5bWJvbCk7XG4gICAgfVxuXG4gICAgaWYocmVuZGVyZXIudHlwZSA9PT0gJ3VuaXF1ZVZhbHVlJykge1xuICAgICAgICByZW5kZXJlci51bmlxdWVWYWx1ZUluZm9zLm1hcChmdW5jdGlvbihpbmZvKSB7XG4gICAgICAgICAgICBpZihpbmZvLnZhbHVlID09PSBwcm9wZXJ0aWVzW3JlbmRlcmVyLmZpZWxkMV0pIHsgLy8gZmllbGQyLCBmaWVsZDPjga/lvozjgafogIPjgYjjgojjgYZcbiAgICAgICAgICAgICAgICB2YXIgc3ltYm9sID0gaW5mby5zeW1ib2w7XG4gICAgICAgICAgICAgICAgaWYocmVuZGVyZXIudmlzdWFsVmFyaWFibGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sID0gX2NhbFZpc3VhbFZhcmlhYmxlcyhpbmZvLnN5bWJvbCwgcmVuZGVyZXIudmlzdWFsVmFyaWFibGVzLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhzeW1ib2wpO1xuICAgICAgICAgICAgICAgIGljb24gPSBfcG9pbnRTeW1ib2woc3ltYm9sKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYocmVuZGVyZXIudHlwZSA9PT0gJ2NsYXNzQnJlYWtzJykge1xuICAgICAgICByZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MubWFwKGZ1bmN0aW9uKGluZm8sIGkpIHtcbiAgICAgICAgICAgIHZhciBwcmV2SW5mbztcbiAgICAgICAgICAgIHZhciBzeW1ib2wgPSBpbmZvLnN5bWJvbDtcblxuICAgICAgICAgICAgaWYoaSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHByZXZJbmZvID0gcmVuZGVyZXIubWluVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwcmV2SW5mbyA9IHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvc1tpLTFdLmNsYXNzTWF4VmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKGluZm8uY2xhc3NNYXhWYWx1ZSwgcHJvcGVydGllc1tyZW5kZXJlci5maWVsZF0sIHByZXZJbmZvKTtcblxuICAgICAgICAgICAgaWYocmVuZGVyZXIuY2xhc3NCcmVha0luZm9zLmxlbmd0aCA9PT0gKGkrMSkpIHtcbiAgICAgICAgICAgICAgICBpZihpbmZvLmNsYXNzTWF4VmFsdWUgPj0gcHJvcGVydGllc1tyZW5kZXJlci5maWVsZF0gJiYgcHJldkluZm8gPD0gcHJvcGVydGllc1tyZW5kZXJlci5maWVsZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYocmVuZGVyZXIudmlzdWFsVmFyaWFibGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN5bWJvbCA9IF9jYWxWaXN1YWxWYXJpYWJsZXMoaW5mby5zeW1ib2wsIHJlbmRlcmVyLnZpc3VhbFZhcmlhYmxlcywgcHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWNvbiA9IF9wb2ludFN5bWJvbChzeW1ib2wpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmKGluZm8uY2xhc3NNYXhWYWx1ZSA+IHByb3BlcnRpZXNbcmVuZGVyZXIuZmllbGRdICYmIHByZXZJbmZvIDw9IHByb3BlcnRpZXNbcmVuZGVyZXIuZmllbGRdKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKHJlbmRlcmVyLnZpc3VhbFZhcmlhYmxlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzeW1ib2wgPSBfY2FsVmlzdWFsVmFyaWFibGVzKGluZm8uc3ltYm9sLCByZW5kZXJlci52aXN1YWxWYXJpYWJsZXMsIHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGljb24gPSBfcG9pbnRTeW1ib2woaW5mby5zeW1ib2wpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGljb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZXNyaVdUTFVybFRlbXBsYXRlVG9MZWFmbGV0ICh1cmwpIHtcbiAgICB2YXIgciA9IC9cXHsoW15cXF1dKilcXH0vZztcbiAgICB2YXIgbmV3VXJsID0gdXJsO1xuXG4gICAgbmV3VXJsID0gbmV3VXJsLnJlcGxhY2UoL1xce2xldmVsfS9nLCAne3p9Jyk7XG4gICAgbmV3VXJsID0gbmV3VXJsLnJlcGxhY2UoL1xce2NvbH0vZywgJ3t4fScpO1xuICAgIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtyb3d9L2csICd7eX0nKTtcbiAgICAvL2NvbnNvbGUubG9nKG5ld1VybCk7XG5cbiAgICByZXR1cm4gbmV3VXJsO1xufVxuXG5leHBvcnQgdmFyIE9wZXJhdGlvbmFsTGF5ZXIgPSB7XG4gIG9wZXJhdGlvbmFsTGF5ZXI6IG9wZXJhdGlvbmFsTGF5ZXJcbn07XG5cbmV4cG9ydCBkZWZhdWx0IE9wZXJhdGlvbmFsTGF5ZXI7IiwiLypcbiAqIEwuZXNyaS5XZWJNYXBcbiAqIEEgbGVhZmxldCBwbHVnaW4gdG8gZGlzcGxheSBBcmNHSVMgV2ViIE1hcC4gaHR0cHM6Ly9naXRodWIuY29tL3ludW5va2F3YS9MLmVzcmkuV2ViTWFwXG4gKiAoYykgMjAxNiBZdXN1a2UgTnVub2thd2FcbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIGBgYGpzXG4gKiB2YXIgd2VibWFwID0gTC53ZWJtYXAoJzIyYzUwNGQyMjlmMTRjNzg5YzViNDllYmZmMzhiOTQxJywgeyBtYXA6IEwubWFwKCdtYXAnKSB9KTtcbiAqIGBgYFxuICovXG5cbmltcG9ydCB7IHZlcnNpb24gfSBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5pbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IG9wZXJhdGlvbmFsTGF5ZXIgfSBmcm9tICcuL09wZXJhdGlvbmFsTGF5ZXInO1xuXG5leHBvcnQgdmFyIFdlYk1hcCA9IEwuRXZlbnRlZC5leHRlbmQoe1xuXHRvcHRpb25zOiB7XG4gICAgICAgIC8vIEwuTWFwXG5cdFx0bWFwOiB7fSxcbiAgICAgICAgLy8gYWNjZXNzIHRva2VuIGZvciBzZWN1cmUgY29udGVudHMgb24gQXJjR0lTIE9ubGluZVxuICAgICAgICB0b2tlbjogbnVsbFxuXHR9LFxuXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uKHdlYm1hcElkLCBvcHRpb25zKSB7XG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG5cdFx0dGhpcy5fbWFwID0gdGhpcy5vcHRpb25zLm1hcDtcbiAgICAgICAgdGhpcy5fdG9rZW4gPSB0aGlzLm9wdGlvbnMudG9rZW47XG5cdFx0dGhpcy5fd2VibWFwSWQgPSB3ZWJtYXBJZDtcbiAgICAgICAgdGhpcy5fbG9hZGVkID0gZmFsc2U7XG5cdFx0dGhpcy5fbWV0YWRhdGFMb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmxheWVycyA9IFtdOyAvLyBDaGVjayB0aGUgbGF5ZXIgdHlwZXMgaGVyZSAtPiBodHRwczovL2dpdGh1Yi5jb20veW51bm9rYXdhL0wuZXNyaS5XZWJNYXAvd2lraS9MYXllci10eXBlc1xuICAgICAgICB0aGlzLnRpdGxlID0gJyc7IC8vIFdlYiBNYXAgVGl0bGVcbiAgICAgICAgdGhpcy5ib29rbWFya3MgPSBbXTsgLy8gV2ViIE1hcCBCb29rbWFya3MgLT4gW3sgbmFtZTogJ0Jvb2ttYXJrIG5hbWUnLCBib3VuZHM6IDxMLmxhdExuZ0JvdW5kcz4gfV1cbiAgICAgICAgdGhpcy5wb3J0YWxJdGVtID0ge307IC8vIFdlYiBNYXAgTWV0YWRhdGFcbiAgICAgICAgXG4gICAgICAgIHRoaXMuVkVSU0lPTiA9IHZlcnNpb247XG5cblx0XHR0aGlzLl9sb2FkV2ViTWFwTWV0YURhdGEod2VibWFwSWQpO1xuXHRcdHRoaXMuX2xvYWRXZWJNYXAod2VibWFwSWQpO1xuXHR9LFxuXG5cdF9sb2FkV2ViTWFwTWV0YURhdGE6IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2codGhpcyk7XG4gICAgICAgIC8vY29uc29sZS5sb2codGhpcy5fdG9rZW4pO1xuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXA7XG5cdFx0dmFyIHdlYm1hcCA9IHRoaXM7XG5cdFx0dmFyIHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCA9ICdodHRwczovL3d3dy5hcmNnaXMuY29tL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZDtcblxuXHRcdEwuZXNyaS5yZXF1ZXN0KHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCwge30sIGZ1bmN0aW9uKGVycm9yLCByZXNwb25zZSl7XG5cdFx0ICBpZihlcnJvcil7XG5cdFx0ICAgIGNvbnNvbGUubG9nKGVycm9yKTtcblx0XHQgIH0gZWxzZSB7XG5cdFx0ICAgIGNvbnNvbGUubG9nKCdXZWJNYXAgTWV0YURhdGE6ICcsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ2V4dGVudDogJywgcmVzcG9uc2UuZXh0ZW50KTtcbiAgICAgICAgICAgIHdlYm1hcC5wb3J0YWxJdGVtID0gcmVzcG9uc2U7XG4gICAgICAgICAgICB3ZWJtYXAudGl0bGUgPSByZXNwb25zZS50aXRsZTtcbiAgICAgICAgICAgIHdlYm1hcC5fbWV0YWRhdGFMb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgd2VibWFwLmZpcmUoJ21ldGFkYXRhTG9hZCcpO1xuICAgICAgICAgICAgbWFwLmZpdEJvdW5kcyhbcmVzcG9uc2UuZXh0ZW50WzBdLnJldmVyc2UoKSwgcmVzcG9uc2UuZXh0ZW50WzFdLnJldmVyc2UoKV0pO1xuXHRcdCAgfVxuXHRcdH0pO1xuXHR9LFxuXG5cdF9sb2FkV2ViTWFwOiBmdW5jdGlvbihpZCkge1xuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXA7XG4gICAgICAgIHZhciBsYXllcnMgPSB0aGlzLmxheWVycztcblx0XHR2YXIgZ2VuZXJhdGVFc3JpTGF5ZXIgPSB0aGlzLl9nZW5lcmF0ZUVzcmlMYXllcjtcblx0XHR2YXIgd2VibWFwUmVxdWVzdFVybCA9ICdodHRwczovL3d3dy5hcmNnaXMuY29tL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZCArICcvZGF0YSc7XG5cblx0XHRMLmVzcmkucmVxdWVzdCh3ZWJtYXBSZXF1ZXN0VXJsLCB7fSwgZnVuY3Rpb24oZXJyb3IsIHJlc3BvbnNlKXtcblx0XHQgIGlmKGVycm9yKXtcblx0XHQgICAgY29uc29sZS5sb2coZXJyb3IpO1xuXHRcdCAgfSBlbHNlIHtcblx0XHQgICAgY29uc29sZS5sb2coJ1dlYk1hcDogJywgcmVzcG9uc2UpO1xuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCdiYXNlTWFwOiAnLCByZXNwb25zZS5iYXNlTWFwKTtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZygnb3BlcmF0aW9uYWxMYXllcnM6ICcsIHJlc3BvbnNlLm9wZXJhdGlvbmFsTGF5ZXJzKTtcblxuXHRcdFx0XHQvLyBBZGQgQmFzZW1hcFxuXHRcdFx0XHRyZXNwb25zZS5iYXNlTWFwLmJhc2VNYXBMYXllcnMubWFwKGZ1bmN0aW9uKGJhc2VNYXBMYXllcikge1xuXHRcdFx0XHRcdHZhciBseXIgPSBvcGVyYXRpb25hbExheWVyKGJhc2VNYXBMYXllciwgbGF5ZXJzLCBtYXApLmFkZFRvKG1hcCk7XG4gICAgICAgICAgICAgICAgICAgIGlmKGx5ciAhPT0gdW5kZWZpbmVkICYmIGJhc2VNYXBMYXllci52aXNpYmlsaXR5ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBseXIuYWRkVG8obWFwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXHRcdFx0XHR9LmJpbmQodGhpcykpO1xuXG5cdFx0XHRcdC8vIEFkZCBPcGVyYXRpb25hbCBMYXllcnNcblx0XHRcdFx0cmVzcG9uc2Uub3BlcmF0aW9uYWxMYXllcnMubWFwKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBseXIgPSBvcGVyYXRpb25hbExheWVyKGxheWVyLCBsYXllcnMsIG1hcCk7XG4gICAgICAgICAgICAgICAgICAgIGlmKGx5ciAhPT0gdW5kZWZpbmVkICYmIGxheWVyLnZpc2liaWxpdHkgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGx5ci5hZGRUbyhtYXApO1xuICAgICAgICAgICAgICAgICAgICB9XG5cdFx0XHRcdH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBZGQgQm9va21hcmtzXG4gICAgICAgICAgICAgICAgaWYocmVzcG9uc2UuYm9va21hcmtzICE9PSB1bmRlZmluZWQgJiYgcmVzcG9uc2UuYm9va21hcmtzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UuYm9va21hcmtzLm1hcChmdW5jdGlvbihib29rbWFyaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXNyaSBFeHRlbnQgR2VvbWV0cnkgdG8gTC5sYXRMbmdCb3VuZHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBub3J0aEVhc3QgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoYm9va21hcmsuZXh0ZW50LnhtYXgsIGJvb2ttYXJrLmV4dGVudC55bWF4KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc291dGhXZXN0ID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGJvb2ttYXJrLmV4dGVudC54bWluLCBib29rbWFyay5leHRlbnQueW1pbikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJvdW5kcyA9IEwubGF0TG5nQm91bmRzKHNvdXRoV2VzdCwgbm9ydGhFYXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYm9va21hcmtzLnB1c2goeyBuYW1lOiBib29rbWFyay5uYW1lLCBib3VuZHM6IGJvdW5kcyB9KTtcbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9sb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuXHRcdCAgfVxuXHRcdH0uYmluZCh0aGlzKSk7XG5cdH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gd2ViTWFwICh3ZWJtYXBJZCwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFdlYk1hcCh3ZWJtYXBJZCwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHdlYk1hcDsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztDQUFPLFNBQVMsa0JBQWtCLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRTtBQUMzRCxDQUFBO0FBQ0EsQ0FBQSxJQUFJLElBQUksQ0FBQyxHQUFHLGVBQWUsQ0FBQztBQUM1QixDQUFBLElBQUksSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDO0FBQ3ZCLENBQUEsSUFBSSxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7O0FBRXJCLENBQUEsSUFBSSxJQUFJLFNBQVMsQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO0FBQ3ZDLENBQUEsUUFBUSxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQztBQUNwQyxDQUFBLEtBQUs7O0FBRUwsQ0FBQSxJQUFJLFNBQVMsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRTtBQUNqRCxDQUFBLFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixDQUFBLFFBQVEsT0FBTyxVQUFV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