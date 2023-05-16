
## Interface升级

### 1. 客户端简化

html页面上直接引入entry文件即可:
```html
<script src='/assets/index.js'></script>
```
不在需要一个单独的cube文件

### 2. 服务端配置化

```js

let cube = new Cube({
  /**
   * 入口文件列表，从static file root开始算，绝对路径
   * @type {Array}
   */
  entrys: [
    '/index.js'
  ],
  globalName: 'Cube', // default is cube
  resourcePath: '/assets', // http加载的resoucepath
  debug: true,
  version: 12345
})

// 挂载middleware
express.use('/assets', cube.service());
```
这些配置都可以编写在静态资源目录下的package.json - "cube" 下


客户端访问路口文件时，会自动添加 cube.js, 以及启动入口。

这样对runtime的能力，可以做到插件化支持，还比较方便，同时入口维持和webpack类似

### cube_loader机制


* 全局API
```js
// load modules
Cube($name,()=>{})
Cube($name, [deps...], ()=>{})

// app entry
Cube.use($name, (app)=> {
  app.run();
})
```

* 模块内API

```js
module.exports

exports

import -> require

export -> require

async('module', (mod)=>{})
```

* CSS加载支持
转换成inline <style/>

* IMAGE加载支持
转换成base64 赋值给 <img data="">

## AST操纵

lib/swc_plugin.js


swc config sample: 
```json

```

## Ref

* js import: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import
* js export: https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/export

* ts module: https://www.typescriptlang.org/docs/handbook/modules.html

* js ast explorer: https://astexplorer.net/
* ts ast explorer: https://ts-ast-viewer.com/
* swc playground: https://swc.rs/playground