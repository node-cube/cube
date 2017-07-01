/**
 *
 * @class  FileNameGenerator
 * 文件名混淆器
 * @private
 */
class FileNameMangle {
  /**
   * [constructor description]
   * @param  {Object} config
   *         - mangleIgnore
   * @return {[type]}        [description]
   */
  constructor(config) {
    this.count = 0;
    this.prefix = [];
    this.fileNameMaps = {};
    this.config = config;
    if (!this.config.mangleIgnore) {
      this.config.mangleIgnore = {};
    }
    this.table = [];
    // a-z
    for (let i = 97; i <= 122; i++) {
      this.table.push(String.fromCharCode(i));
    }
    /* 注意mac下大小写文件名不区分，容易bug
    // A-Z
    for (let i = 65; i <= 90; i++) {
      this.table.push(String.fromCharCode(i));
    }
    */
    // 0-9
    /*
    for (let i = 48; i <= 57; i++) {
      this.table.push(String.fromCharCode(i));
    }
    */
  }
  /**
   * mangle
   * @param {String} fileName original filename
   * @param {Function} fn(alias) { return modified_alias}
   * @return {String} new filename
   */
  mangle(fileName, fn) {
    let fileNameMaps = this.fileNameMaps;
    let finalName;
    var mangleIgnore = this.config.mangleIgnore;

    fn = fn || function (k) { return k;};

    if (fileName.indexOf('/') !== 0) {
      finalName = fn(fileName);
    } else if (mangleIgnore[fileName]) {
      finalName = fn(fileName);
    } else if (fileNameMaps[fileName]) {
      finalName = fileNameMaps[fileName];
    } else {
      finalName = fn(this.allocName());
      fileNameMaps[fileName] = finalName;
    }

    return finalName;
  }
  /**
   * 分配新名字
   * @private
   */
  allocName() {
    let prefix = this.prefix;
    let count = this.count;
    let table = this.table;

    let tableLen = table.length;


    var lastPrefixIndex = prefix.length ? prefix.length - 1 : 0;
    var lastPrefix = prefix[lastPrefixIndex];
    if (count >= tableLen) {
      count = 0;
      if (lastPrefix === undefined) {
        prefix.push(0);
      } else {
        lastPrefix += 1;
        if (lastPrefix >= tableLen) {
          prefix.push(0);
        } else {
          prefix[lastPrefixIndex] = lastPrefix;
        }
      }
    }
    var value = '';
    prefix.forEach(function (v) {
      value += table[v];
    });
    value += table[count];
    count ++;
    this.count = count;
    return value;
  }
}

module.exports = FileNameMangle;
