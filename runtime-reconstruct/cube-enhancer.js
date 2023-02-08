// 支持 cube 的一些工具方法
export function noop() {}
export function approve() {
  return true;
}
function baseCodeProxy(c) {
  return c;
}
export function combineExecute(c) {
  return 'Cube.cStart();' + c + ';Cube.cStop();';
}
export function fetchCubeCode(url, inputCodeProxy) {
  const codeProxy = inputCodeProxy || baseCodeProxy;
  return fetch(url, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
    .then((response) => response.text())
    .then((code) => new Function(codeProxy(code))());
}
const head = document.querySelector('head');
/** 原有 cube 请求方法 */
export function scriptCubeCode(url) {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.onerror = () => {
    window.Cube(require, [], () => {
      console.error(`load module: ${require} failed.`);
    });
  };
  script.src = url;
  head.appendChild(script);
}
export function generateModuleCallback(moduleNames, callback) {
  const exportModules = {};
  return function (exportModule, path) {
    exportModules[path] = exportModule;
    // 外部调用时保障了对应关系 此处简单判断
    if (Object.keys(exportModules).length === moduleNames.length) {
      // 保证 module 顺序
      callback(...moduleNames.map((k) => exportModules[k]));
      return true;
    }
    return false;
  };
}
export function fixMododulePath(paths, remoteSeparator) {
  var len = paths.length;
  var mod;
  for (var i = 0; i < len; i++) {
    mod = paths[i];
    if (mod.indexOf(remoteSeparator) === -1) {
      /** fix #12 **/
      if (mod.indexOf('./') === 0) {
        // be compatible with ./test.js
        paths[i] = mod.substr(1);
      } else if (mod[0] !== '/') {
        // be campatible with test.js
        paths[i] = '/' + mod;
      }
    }
  }
  return paths;
}
const parseCssRe = /([^};]+)(\{[^}]+\})/g;
/** 原有 css 请求方法 */
export function scriptCubeCss(originCss, namespace, file) {
  let css = originCss;
  if (namespace) {
    css = originCss.replace(parseCssRe, function (_m0, m1, m2) {
      var selectors = m1.split(',').map(function (selector) {
        return namespace + ' ' + selector.trim();
      });
      return selectors.join(',') + m2;
    });
  }
  var style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  if (file) {
    style.setAttribute('mod', file);
  }
  if (namespace) {
    style.setAttribute('ns', namespace);
  }
  head.appendChild(style);
  style.innerHTML = css;
  return css;
}
export function parseQueryString(param) {
  let kvs = param.split('&');
  let obj = {};
  kvs.forEach((kv) => {
    let tmp = kv.split('=');
    obj[tmp[0]] = tmp[1];
  });
  return obj;
}
/**
 * If name is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
 */
export function rebase(name, config) {
  const { base, remoteSeparator, remoteBase } = config;
  let defaultPath = base + name;
  var offset = name.indexOf ? name.indexOf(remoteSeparator) : 0;
  if (offset <= 0) return defaultPath;
  var rbase = name.substr(0, offset);
  if (!remoteBase[rbase]) return defaultPath;
  return remoteBase[rbase] + name.substr(offset + 1);
}
export function intercept() {
  console.time('intercept exec');
  const referer = 'intercept_mock';
  const dep = [];
  const proxy = (c) => {
    const d = c.replaceAll('Cube(', 'Cube._store(');
    // console.log(d);
    return d;
  };
  return Promise.all(
    dep.map((s) => {
      const [mod, custom] = String(s).split('?');
      const config = window.Cube.config;
      var srcPath = rebase(mod, config);
      const { version, debug } = config;
      var query = [];
      if (version) {
        query.push(version);
      }
      if (debug) {
        query.push('m');
        query.push('ref=' + referer);
      }
      if (custom) {
        const customArgs = parseQueryString(custom);
        Array.prototype.push.apply(
          query,
          Object.keys(customArgs).map((c) => {
            return `${c}=${customArgs[c]}`;
          })
        );
      }
      if (query.length) {
        srcPath = srcPath + '?' + query.join('&');
      }
      return fetchCubeCode(srcPath, proxy);
    })
  ).then(() => {
    console.timeEnd('intercept exec');
  });
}
