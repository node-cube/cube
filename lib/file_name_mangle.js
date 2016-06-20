/**
 *
 * @class  FileNameGenerator
 * 文件名混淆器
 * @private
 */
class FileNameMangle {
  constructor(config) {
    this.count = 97;
    this.prefix = [];
    this.fileNameMaps = {};
    this.config = config;
  }
  /**
   * mangle
   * @param  {String} fileName original filename
   * @return {String} new filename
   */
  mangle(fileName) {
    let fileNameMaps = this.fileNameMaps;
    var mangleFileNameIgnore = this.config.mangleFileNameIgnore;
    if (fileName.indexOf('/') !== 0) {
      return fileName;
    }
    if (mangleFileNameIgnore && mangleFileNameIgnore.indexOf(fileName) >= 0) {
      return fileName;
    }
    if (fileNameMaps[fileName]) {
      return fileNameMaps[fileName];
    }
    var alias = this.allocName();
    fileNameMaps[fileName] = alias;
    return alias;
  }
  /**
   * 分配新名字
   * @private
   */
  allocName() {
    let prefix = this.prefix;
    let count = this.count;
    //97 ~ 122 a-z
    var lastPrefixIndex = prefix.length ? prefix.length - 1 : 0;
    var lastPrefix = prefix[lastPrefixIndex];
    if (count === 123) {
      count = 97;
      if (!lastPrefix) {
        lastPrefix = 97;
      } else {
        lastPrefix += 1;
      }
      if (lastPrefix === 123) {
        lastPrefix -= 1;
        prefix.push(97);
      }
      prefix[lastPrefixIndex] = lastPrefix;
    }
    var value = '';
    prefix.forEach(function (v) {
      if (v) {
        value += String.fromCharCode(v);
      }
    });
    value += String.fromCharCode(count);
    count ++;
    return value;
  }
}

module.exports = FileNameMangle;
