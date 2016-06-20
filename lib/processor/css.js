'use strict';

class CssProcessor {
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
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
