# L.esri.WebMap

A plugin to display [ArcGIS Web Map](http://doc.arcgis.com/en/arcgis-online/reference/what-is-web-map.htm) on Leaflet maps.

You can see it with just 2 lines code.

```JavaScript
var webmapId = '22c504d229f14c789c5b49ebff38b941';
var webmap = L.esri.webMap(webmapId, { map: L.map('map') });
```

Web Map has an enormous spec. So, welcome your contributions to support fully!

## Demo

You can see your web maps (that are open to the public) with URL parameter as the below.

`http://ynunokawa.github.io/L.esri.WebMap/test.html?webmap=[your webmap id]`

* [Various styles for a feature layer](http://ynunokawa.github.io/L.esri.WebMap/test.html?webmap=722f3d8ed5e94babbe78c8236a28b42e)
* []()

## License
Copyright 2016 Yusuke Nunokawa.

MIT.
