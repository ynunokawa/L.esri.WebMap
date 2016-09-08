export function createPopupContent (popupInfo, properties) {
  // console.log(popupInfo, properties);
  var r = /\{([^\]]*)\}/g;
  var titleText = '';
  var content = '';

  if (popupInfo.title !== undefined) {
    titleText = popupInfo.title;
  }

  titleText = titleText.replace(r, function (s) {
    var m = r.exec(s);
    return properties[m[1]];
  });

  content = '<div class="leaflet-popup-content-title"><h4>' + titleText + '</h4></div><div class="leaflet-popup-content-description" style="max-height:200px;overflow:auto;">';

  if (popupInfo.fieldInfos !== undefined) {
    for (var i = 0; i < popupInfo.fieldInfos.length; i++) {
      if (popupInfo.fieldInfos[i].visible === true) {
        content += '<div style="font-weight:bold;color:#999;margin-top:5px;word-break:break-all;">' + popupInfo.fieldInfos[i].label + '</div><p style="margin-top:0;margin-bottom:5px;word-break:break-all;">' + properties[popupInfo.fieldInfos[i].fieldName] + '</p>';
      }
    }
    content += '</div>';
  } else if (popupInfo.description !== undefined) {
    // KMLLayer popup
    var descriptionText = popupInfo.description.replace(r, function (s) {
      var m = r.exec(s);
      return properties[m[1]];
    });
    content += descriptionText + '</div>';
  }

  // if (popupInfo.mediaInfos.length > 0) {
    // It does not support mediaInfos for popup contents.
  // }

  return content;
}

export var Popup = {
  createPopupContent: createPopupContent
};

export default Popup;
