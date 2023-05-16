'use strict';

class CssProcessor {
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
    // TODO parse css, minify css, namespace etc.
    console.log(data);
    callback(null, data);
  }
}

/**
 * process type
 */
CssProcessor.type = 'style';
/**
 * process default ext
 */
CssProcessor.ext = '.css';

module.exports = CssProcessor;
