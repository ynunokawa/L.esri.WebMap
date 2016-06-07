# L.esri.WebMap

A plugin to display [ArcGIS Web Map](http://doc.arcgis.com/en/arcgis-online/reference/what-is-web-map.htm) on Leaflet maps.

You can see it with just 1 line code.

```JavaScript
// L.esri.WebMap(webmapId, { map: L.Map });
var webmap = L.esri.webMap('22c504d229f14c789c5b49ebff38b941', { map: L.map('map') });
```

Web Map has an enormous spec. So, welcome your contributions to support fully!

## Demo

You can see your web maps (that are open to the public) with URL parameter as the below.

`http://ynunokawa.github.io/L.esri.WebMap/index.html?webmap=[your webmap id]`

* [Various styles for a feature layer](http://ynunokawa.github.io/L.esri.WebMap/index.html?webmap=722f3d8ed5e94babbe78c8236a28b42e)
* []()

## Limitations

Please see [here](https://github.com/ynunokawa/L.esri.WebMap/wiki/Supported-Features).

## License
Copyright 2016 Yusuke Nunokawa.

MIT.
