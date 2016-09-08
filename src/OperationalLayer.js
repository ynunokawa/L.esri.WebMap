import L from 'leaflet';
import { featureCollection } from './FeatureCollection/FeatureCollection';
import { csvLayer } from './FeatureCollection/CSVLayer';
import { kmlLayer } from './FeatureCollection/KMLLayer';
import { labelMarker } from './Label/LabelMarker';
import { pointLabelPos } from './Label/PointLabel';
import { polylineLabelPos } from './Label/PolylineLabel';
import { polygonLabelPos } from './Label/PolygonLabel';
import { createPopupContent } from './Popup/Popup';

export function operationalLayer (layer, layers, map, paneName) {
  return _generateEsriLayer(layer, layers, map, paneName);
}

export function _generateEsriLayer (layer, layers, map, paneName) {
  console.log('generateEsriLayer: ', layer.title, layer);
  var lyr;
  var labels = [];
  var labelsLayer;
  var labelPaneName = paneName + '-label';

  if (layer.type === 'Feature Collection' || layer.featureCollection !== undefined) {
    console.log('create FeatureCollection');

    map.createPane(labelPaneName);

    var i, len;
    var popupInfo, labelingInfo;
    if (layer.itemId === undefined) {
      for (i = 0, len = layer.featureCollection.layers.length; i < len; i++) {
        if (layer.featureCollection.layers[i].featureSet.features.length > 0) {
          if (layer.featureCollection.layers[i].popupInfo !== undefined && layer.featureCollection.layers[i].popupInfo !== null) {
            popupInfo = layer.featureCollection.layers[i].popupInfo;
          }
          if (layer.featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo !== undefined && layer.featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo !== null) {
            labelingInfo = layer.featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo;
          }
        }
      }
    }

    labelsLayer = L.featureGroup(labels);
    var fc = featureCollection(null, {
      data: layer.itemId || layer.featureCollection,
      opacity: layer.opacity,
      pane: paneName,
      onEachFeature: function (geojson, l) {
        if (fc !== undefined) {
          popupInfo = fc.popupInfo;
          labelingInfo = fc.labelingInfo;
        }
        if (popupInfo !== undefined && popupInfo !== null) {
          var popupContent = createPopupContent(popupInfo, geojson.properties);
          l.bindPopup(popupContent);
        }
        if (labelingInfo !== undefined && labelingInfo !== null) {
          var coordinates = l.feature.geometry.coordinates;
          var labelPos;

          if (l.feature.geometry.type === 'Point') {
            labelPos = pointLabelPos(coordinates);
          } else if (l.feature.geometry.type === 'LineString') {
            labelPos = polylineLabelPos(coordinates);
          } else if (l.feature.geometry.type === 'MultiLineString') {
            labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
          } else {
            labelPos = polygonLabelPos(l);
          }

          var label = labelMarker(labelPos.position, {
            zIndexOffset: 1,
            properties: geojson.properties,
            labelingInfo: labelingInfo,
            offset: labelPos.offset,
            pane: labelPaneName
          });

          labelsLayer.addLayer(label);
        }
      }
    });

    lyr = L.layerGroup([fc, labelsLayer]);

    layers.push({ type: 'FC', title: layer.title || '', layer: lyr });

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
          gradient: gradient,
          pane: paneName
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

        map.createPane(labelPaneName);

        labelsLayer = L.featureGroup(labels);

        lyr = L.esri.featureLayer({
          url: layer.url,
          where: where,
          drawingInfo: drawingInfo,
          pane: paneName,
          onEachFeature: function (geojson, l) {
            if (layer.popupInfo !== undefined) {
              var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
              l.bindPopup(popupContent);
            }
            if (layer.layerDefinition.drawingInfo.labelingInfo !== undefined && layer.layerDefinition.drawingInfo.labelingInfo !== null) {
              var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
              var coordinates = l.feature.geometry.coordinates;
              var labelPos;

              if (l.feature.geometry.type === 'Point') {
                labelPos = pointLabelPos(coordinates);
              } else if (l.feature.geometry.type === 'LineString') {
                labelPos = polylineLabelPos(coordinates);
              } else if (l.feature.geometry.type === 'MultiLineString') {
                labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
              } else {
                labelPos = polygonLabelPos(l);
              }

              var label = labelMarker(labelPos.position, {
                zIndexOffset: 1,
                properties: geojson.properties,
                labelingInfo: labelingInfo,
                offset: labelPos.offset,
                pane: labelPaneName
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
        pane: paneName,
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
      pane: paneName,
      onEachFeature: function (geojson, l) {
        if (layer.popupInfo !== undefined) {
          var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
          l.bindPopup(popupContent);
        }
      }
    });

    layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'CSV') {
    labelsLayer = L.featureGroup(labels);
    lyr = csvLayer(null, {
      url: layer.url,
      layerDefinition: layer.layerDefinition,
      locationInfo: layer.locationInfo,
      opacity: layer.opacity,
      pane: paneName,
      onEachFeature: function (geojson, l) {
        if (layer.popupInfo !== undefined) {
          var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
          l.bindPopup(popupContent);
        }
        if (layer.layerDefinition.drawingInfo.labelingInfo !== undefined && layer.layerDefinition.drawingInfo.labelingInfo !== null) {
          var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
          var coordinates = l.feature.geometry.coordinates;
          var labelPos;

          if (l.feature.geometry.type === 'Point') {
            labelPos = pointLabelPos(coordinates);
          } else if (l.feature.geometry.type === 'LineString') {
            labelPos = polylineLabelPos(coordinates);
          } else if (l.feature.geometry.type === 'MultiLineString') {
            labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
          } else {
            labelPos = polygonLabelPos(l);
          }

          var label = labelMarker(labelPos.position, {
            zIndexOffset: 1,
            properties: geojson.properties,
            labelingInfo: labelingInfo,
            offset: labelPos.offset,
            pane: labelPaneName
          });

          labelsLayer.addLayer(label);
        }
      }
    });

    lyr = L.layerGroup([lyr, labelsLayer]);

    layers.push({ type: 'CSV', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'KML') {
    labelsLayer = L.featureGroup(labels);
    var kml = kmlLayer(null, {
      url: layer.url,
      opacity: layer.opacity,
      pane: paneName,
      onEachFeature: function (geojson, l) {
        if (kml.popupInfo !== undefined && kml.popupInfo !== null) {
          console.log(kml.popupInfo);
          var popupContent = createPopupContent(kml.popupInfo, geojson.properties);
          l.bindPopup(popupContent);
        }
        if (kml.labelingInfo !== undefined && kml.labelingInfo !== null) {
          var labelingInfo = kml.labelingInfo;
          var coordinates = l.feature.geometry.coordinates;
          var labelPos;

          if (l.feature.geometry.type === 'Point') {
            labelPos = pointLabelPos(coordinates);
          } else if (l.feature.geometry.type === 'LineString') {
            labelPos = polylineLabelPos(coordinates);
          } else if (l.feature.geometry.type === 'MultiLineString') {
            labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
          } else {
            labelPos = polygonLabelPos(l);
          }

          var label = labelMarker(labelPos.position, {
            zIndexOffset: 1,
            properties: geojson.properties,
            labelingInfo: labelingInfo,
            offset: labelPos.offset,
            pane: labelPaneName
          });

          labelsLayer.addLayer(label);
        }
      }
    });

    lyr = L.layerGroup([kml, labelsLayer]);

    layers.push({ type: 'KML', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'ArcGISImageServiceLayer') {
    console.log('create ArcGISImageServiceLayer');
    lyr = L.esri.imageMapLayer({
      url: layer.url,
      pane: paneName,
      opacity: layer.opacity || 1
    });

    layers.push({ type: 'IML', title: layer.title || '', layer: lyr });

    return lyr;
  } else if (layer.layerType === 'ArcGISMapServiceLayer') {
    lyr = L.esri.dynamicMapLayer({
      url: layer.url,
      pane: paneName,
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
