import { polylabel } from 'polylabel';

export function polygonLabelPos (layer, coordinates) {
  console.log(polylabel(layer, 1.0));
  var labelPos = { position: [], offset: [] };

  labelPos.position = layer.getBounds().getCenter();
  labelPos.offset = [0, 0];

  return labelPos;
}

export var PolygonLabel = {
  polygonLabelPos: polygonLabelPos
};

export default PolygonLabel;