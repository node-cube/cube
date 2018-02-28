(function () {
  let a = document.createElement('a');
  a.innerHTML = ' ';
  a.style.backgroundColor = 'yellow';
  a.style.position = 'absolute';
  a.style.zIndex = 10000000;
  a.style.bottom = '2px';
  a.style.left = '2px';
  a.style.width = '16px';
  a.style.height = '16px';
  a.style.cursor = 'pointer';
  a.style.opacity = '0.2';
  a.style.borderRadius = '8px';

  let base = document.currentScript;
  if (base) {
    base = base.src.replace(/[^/]+\.js/, '__clean_cache__');
  }
  document.body.appendChild(a);
  a.onmouseover = function () {
    this.style.opacity = '0.8';
  };
  a.onmouseout = function () {
    this.style.opacity = '0.2';
  };
  a.onclick = function () {
    if (!base) {
      return;
    }
    let img = document.createElement('img');
    img.src = base;
    img.onerror = function () {
      delete img.onerror;
      delete img;
      location.reload();
    };
    img.onload = function () {
      delete img.onerror;
      delete img;
      location.reload();
    };
  };
})();