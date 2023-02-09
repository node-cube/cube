'use strict';

const fs = require('xfs');
const path = require('path');
const pkg = require('../package.json');
const fpath1 = path.join(__dirname, '../runtime/cube.min.js');
const fpath2 = path.join(__dirname, '../runtime/cube-reconstruction.min.js');

function combine(fpath) {
  let code = fs.readFileSync(fpath).toString();

  code = code.replace(/\$\$version\$\$/, pkg.version);
  const cmt =
  `/*!
  * Cube v${pkg.version}
  */
  `;

  fs.writeFileSync(fpath, cmt + code);
}

combine(fpath1);
combine(fpath2);