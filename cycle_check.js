var RTREE = {};

exports.setRequires = function (module, requires) {
  requires.forEach(function (name) {
    if (!RTREE[name]) {
      RTREE[name] = {};
    }
    RTREE[name][module] = true;
  });
};

exports.check = function (name, parents) {
  if (!parents) {
    parents = [name];
  }
  var tmp = RTREE[name];
  var tmpParent;
  var flags;
  if (!tmp) {
    return false;
  }
  var res = [];
  Object.keys(tmp).forEach(function (i) {
    if (parents.indexOf(i) !== -1) {
      parents.unshift(i);
      console.warn('[WARNNING]', 'cycle require : ' + parents.join(' > '));
      return parents;
    }
    tmpParent = parents.slice(0);
    tmpParent.unshift(i);
    flags = this.check(i, tmpParent);
    if (flags) {
      res = res.concat(flags);
    }
  });
  return flags.length ? flags : false;
};
