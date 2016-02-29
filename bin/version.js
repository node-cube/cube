'use strict';

var fs = require('xfs');
var path = require('path');
var pkg = require('../package.json');
var fpath = path.join(__dirname, '../runtime/cube.min.js');
var code = fs.readFileSync(fpath).toString();

code = code.replace(/\$\$version\$\$/, pkg.version);
var cmt =
`/*!
 * Cube v${pkg.version}
 */
`;

fs.writeFileSync(fpath, cmt + code);