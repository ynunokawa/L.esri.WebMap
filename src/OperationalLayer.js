import L from 'leaflet';
import { createPopupContent } from './Popup/Popup';
import { createLabelText } from './Label/Label';

export function operationalLayer (layer, layers, map) {
  return _generateEsriLayer(layer, layers, map);
}

export function _generateEsriLayer (layer, layers, map) {
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
export function _pointSymbol (symbol) {
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

export function _pathSymbol (symbol) {
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

export function _calVisualVariables (symbol, visualVariables, properties) {
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

export function _generatePathStyle (renderer, properties) {
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

export function _generateIcon (renderer, properties) {
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

export function _esriWTLUrlTemplateToLeaflet (url) {
    var r = /\{([^\]]*)\}/g;
    var newUrl = url;

    newUrl = newUrl.replace(/\{level}/g, '{z}');
    newUrl = newUrl.replace(/\{col}/g, '{x}');
    newUrl = newUrl.replace(/\{row}/g, '{y}');
    //console.log(newUrl);

    return newUrl;
}

export var OperationalLayer = {
  operationalLayer: operationalLayer
};

export default OperationalLayer;