import L from 'leaflet';
import { featureCollection } from './FeatureCollection/FeatureCollection';
import { labelMarker } from './Label/LabelMarker';
import { createPopupContent } from './Popup/Popup';

export function operationalLayer (layer, layers, map) {
  return _generateEsriLayer(layer, layers, map);
}

export function _generateEsriLayer (layer, layers, map) {
  console.log('generateEsriLayer: ', layer.title, layer);
  var lyr;
  var labels = [];
  var labelsLayer;

  if (layer.featureCollection !== undefined) {
    console.log('create FeatureCollection');

    if (layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo && layer.featureCollection.layers[0].featureSet) {
      layer.featureCollection.layers[0].featureSet.features.map(function (feature) {
        var mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(feature.geometry.x, feature.geometry.y));
        var labelingInfo = layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo;

        var label = labelMarker(mercatorToLatlng, {
          zIndexOffset: 1,
          properties: feature.attributes,
          labelingInfo: labelingInfo,
          offset: [20, 20]
        });

        labels.push(label);
      });
    }

    lyr = featureCollection([], {
      data: layer.itemId || layer.featureCollection,
      opacity: layer.opacity,
      renderer: layer.featureCollection.layers[0].layerDefinition.drawingInfo.renderer,
      onEachFeature: function (geojson, l) {
        if (layer.featureCollection.layers[0].popupInfo !== undefined) {
          var popupContent = createPopupContent(layer.featureCollection.layers[0].popupInfo, geojson.properties);
          l.bindPopup(popupContent);
        }
      }
    });

    if (labels.length > 0) {
      labelsLayer = L.featureGroup(labels);
      lyr = L.layerGroup([lyr, labelsLayer]);
    }

    layers.push({ type: 'FC', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.type === 'Feature Collection') {
    console.log('create FeatureCollection without featureCollection property');
    lyr = featureCollection([], {
      data: layer.itemId,
      opacity: layer.opacity
    });

    return lyr;
  } else if (layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition !== undefined) {
    var where = '1=1';
    if (layer.layerDefinition.drawingInfo !== undefined) {
      if (layer.layerDefinition.drawingInfo.renderer.type === 'heatmap') {
        console.log('create HeatmapLayer');
        var gradient = {};

        layer.layerDefinition.drawingInfo.renderer.colorStops.map(function (stop) {
          // gradient[stop.ratio] = 'rgba(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ',' + (stop.color[3]/255) + ')';
          // gradient[Math.round(stop.ratio*100)/100] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
          gradient[(Math.round(stop.ratio * 100) / 100 + 6) / 7] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
        });

        lyr = L.esri.Heat.heatmapFeatureLayer({ // Esri Leaflet 2.0
        // lyr = L.esri.heatmapFeatureLayer({ // Esri Leaflet 1.0
          url: layer.url,
          minOpacity: 0.5,
          max: layer.layerDefinition.drawingInfo.renderer.maxPixelIntensity,
          blur: layer.layerDefinition.drawingInfo.renderer.blurRadius,
          radius: layer.layerDefinition.drawingInfo.renderer.blurRadius * 1.3,
          gradient: gradient
        });

        layers.push({ type: 'HL', title: layer.title || '', layer: lyr });

        return lyr;
      } else {
        console.log('create ArcGISFeatureLayer (with layerDefinition.drawingInfo)');
        var drawingInfo = layer.layerDefinition.drawingInfo;
        drawingInfo.transparency = 100 - (layer.opacity * 100);
        console.log(drawingInfo.transparency);

        if (layer.layerDefinition.definitionExpression !== undefined) {
          where = layer.layerDefinition.definitionExpression;
        }

        labelsLayer = L.featureGroup(labels);
        lyr = L.esri.featureLayer({
          url: layer.url,
          where: where,
          drawingInfo: drawingInfo,
          onEachFeature: function (geojson, l) {
            if (layer.popupInfo !== undefined) {
              var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
              l.bindPopup(popupContent);
            }
            if (layer.layerDefinition.drawingInfo.labelingInfo !== undefined) {
              var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;

              var labelPos;
              var centralKey;
              var c, c2;
              var offset = [0, 0];

              if (l.feature.geometry.type === 'Point') {
                labelPos = l.feature.geometry.coordinates.reverse();
                offset = [20, 20];
              } else if (l.feature.geometry.type === 'LineString') {
                c = l.feature.geometry.coordinates;
                centralKey = Math.round(c.length / 2);
                labelPos = c[centralKey].reverse();
              } else if (l.feature.geometry.type === 'MultiLineString') {
                c = l.feature.geometry.coordinates;
                centralKey = Math.round(c.length / 2);
                c2 = c[centralKey];
                centralKey = Math.round(c2.length / 2);

                labelPos = c2[centralKey].reverse();
              } else {
                labelPos = l.getBounds().getCenter();
              }

              var label = labelMarker(labelPos, {
                zIndexOffset: 1,
                properties: geojson.properties,
                labelingInfo: labelingInfo,
                offset: offset
              });

              labelsLayer.addLayer(label);
            }
          }
        });

        lyr = L.layerGroup([lyr, labelsLayer]);

        layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

        return lyr;
      }
    } else {
      console.log('create ArcGISFeatureLayer (without layerDefinition.drawingInfo)');

      if (layer.layerDefinition.definitionExpression !== undefined) {
        where = layer.layerDefinition.definitionExpression;
      }

      lyr = L.esri.featureLayer({
        url: layer.url,
        where: where,
        onEachFeature: function (geojson, l) {
          if (layer.popupInfo !== undefined) {
            var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
            l.bindPopup(popupContent);
          }
        }
      });

      layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

      return lyr;
    }
  } else if (layer.layerType === 'ArcGISFeatureLayer') {
    console.log('create ArcGISFeatureLayer');
    lyr = L.esri.featureLayer({
      url: layer.url,
      onEachFeature: function (geojson, l) {
        if (layer.popupInfo !== undefined) {
          var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
          l.bindPopup(popupContent);
        }
      }
    });

    layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'ArcGISImageServiceLayer') {
    console.log('create ArcGISImageServiceLayer');
    lyr = L.esri.imageMapLayer({
      url: layer.url,
      opacity: layer.opacity || 1
    });

    layers.push({ type: 'IML', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'ArcGISMapServiceLayer') {
    lyr = L.esri.dynamicMapLayer({
      url: layer.url,
      opacity: layer.opacity || 1
    });

    layers.push({ type: 'DML', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'ArcGISTiledMapServiceLayer') {
    try {
      lyr = L.esri.basemapLayer(layer.title);
    } catch (e) {
      lyr = L.esri.tiledMapLayer({
        url: layer.url
      });

      L.esri.request(layer.url, {}, function (err, res) {
        if (err) {
          console.log(err);
        } else {
          var maxWidth = (map.getSize().x - 55);
          var tiledAttribution = '<span class="esri-attributions" style="line-height:14px; vertical-align: -3px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; display:inline-block; max-width:' + maxWidth + 'px;">' + res.copyrightText + '</span>';
          map.attributionControl.addAttribution(tiledAttribution);
        }
      });
    }

    document.getElementsByClassName('leaflet-tile-pane')[0].style.opacity = layer.opacity || 1;

    layers.push({ type: 'TML', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'OpenStreetMap') {
    lyr = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    });

    layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'WebTiledLayer') {
    var lyrUrl = _esriWTLUrlTemplateToLeaflet(layer.templateUrl);
    lyr = L.tileLayer(lyrUrl, {
      attribution: layer.copyright
    });
    document.getElementsByClassName('leaflet-tile-pane')[0].style.opacity = layer.opacity || 1;

    layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

    return lyr;
  } else {
    lyr = L.featureGroup([]);
    console.log('Unsupported Layer: ', layer);
    return lyr;
  }
}

export function _esriWTLUrlTemplateToLeaflet (url) {
  var newUrl = url;

  newUrl = newUrl.replace(/\{level}/g, '{z}');
  newUrl = newUrl.replace(/\{col}/g, '{x}');
  newUrl = newUrl.replace(/\{row}/g, '{y}');

  return newUrl;
}

export var OperationalLayer = {
  operationalLayer: operationalLayer,
  _generateEsriLayer: _generateEsriLayer,
  _esriWTLUrlTemplateToLeaflet: _esriWTLUrlTemplateToLeaflet
};

export default OperationalLayer;
