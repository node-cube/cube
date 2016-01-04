!(function (Cube) {
var parseCssRe = /\}\n?([\s\S]*?)\{/g;
Cube.css = function (css, namespace, file) {
  if (!css) {
    return;
  }
  if (namespace) {
    css = '}' + css;
    css = css.replace(parseCssRe, function (match, p1) {
      var selectors = p1.split(',').map(function (selector) {
        return namespace + ' ' + selector.trim();
      });
      selectors = selectors.join(',');

      return '}\n' + selectors + '{';
    });
    css = css.slice(1);
  }

  var headNode = document.getElementsByTagName('HEAD')[0];
  var style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.setAttribute('mod', file);
  if (namespace) {
    style.setAttribute('ns', namespace);
  }
  headNode.appendChild(style);
  style.innerHTML = css;
};

})(Cube);