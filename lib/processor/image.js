'use strict';

class JsProcessor {
  constructor (cube) {
    this.cube = cube;
  }
  process (data, callback) {
    let ext = data.ext;
    if (!ext) {
      ext = '.jpg';
    }
    let type = ext.substr(1);
    if (type === 'jpg') {
      type = 'jpeg';
    }
    data.code = `data:image/${type};base64,${Buffer.from(data).toString('base64')}`;
    callback(null, data);
  }
}

JsProcessor.type = 'image';
module.exports = JsProcessor;
