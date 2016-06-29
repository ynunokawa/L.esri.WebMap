export function createLabelText (properties, labelingInfo) {
  var r = /\[([^\]]*)\]/g;
  var labelText = labelingInfo[0].labelExpression;

  labelText = labelText.replace(r, function (s) {
    var m = r.exec(s);
    return properties[m[1]];
  });

  return labelText;
}

export var Label = {
  createLabelText: createLabelText
};

export default Label;
