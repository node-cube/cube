Cube
=================

![logo](https://raw.github.com/fishbar/cube/master/logo.png)

模块化你的前端代码，像node.js一样编写模块, 发布npm变成共享模块。

Cube管理着前端三种类型的资源:

* script js/coffee/jsx/...
* style css/stylus/less/...
* template html/ejs/jade/...

[![Build Status](https://travis-ci.org/node-cube/cube.svg)](https://travis-ci.org/node-cube/cube)
[![NPM version](https://badge.fury.io/js/node-cube.svg)](http://badge.fury.io/js/node-cube)

## Install

  npm install -g node-cube

  推荐全局安装，有cli命令支持

## Getting Start

初始化cube，通过cube命令，生成工程结构，包含 `cube.min.js`，`index.html`

```sh
> cd your_project_dir
> cube init
```
### 初始化前端代码
查看`index.html`, cube 客户端的部署大致如下

```
<script src='cube.min.js'></script>
<script>
  Cube.init({
    charset: 'utf-8',
    base: '/',                // virtual path, base can be a http path,
                              // like: http://domain.com/project/static
    debug: true,              // online module ,you should turn off this switch
    version: 12345,           // the code version, used for flushing client side script
    timeout: 15000            // loading script timeout setup
  });
  Cube.use('/main.js', function (App) {
    console.log(App.run(appConfig));
  });
</script>
```

Cube.use 还可以支持多模块加载:
```
Cube.use(['/a.js', '/b.js'], function (a, b) {
  // a -> a.js
  // b -> b.js
});
```

Cube.use 传入的参数寻址，基于当前 init的时候指定的base， 即跟目录下。

```
Cube.use('/app.js');
Cube.use('./app.js');
Cube.use('app.js');
```
以上是等效的，都引用了主类目下的  app.js 模块


### 启动cube服务
```sh
> cube start your_project_dir
```
好了，cube可以工作了， 修改`main.js`，开始编码。

## Write code with cube

前面已经启动了服务，

```js
// main.js
var cookie = require('cookie');
var tpl = require('./tset.html');

function  init() {
  // init layout
  $('body .main').html(tpl());
  // get nick
  var nick = cookie.get('nick');
  if (!nick) {
    nick = 'guest';
  }
  $('.node-nick').text(nick);
}
init();
// 异步加载css
async('../css/module.css', nameSpace); // namespace: prefix for css selector
```
ok，一个很简单的一个模块，`index.html`加载了main.js，便开始执行：设置头部用户登录昵称

Cube的模块加载是支持像node一样寻址node_modules目录的，在wwwroot目录下安装模块，可以被直接require使用， 所以可以把稳定的代码模块，发布到npm公用吧！

引用现有的包， 你只需要

  * 编写好package依赖
  * `npm install`  注意这里的`npm install`是安装在静态资源目录，不是工程根目录。
  * 像node一样引用这些模块

注意node_modules，虽然和node.js的模块一模一样使用，但是它们安装在不同的地方。
前端工程里使用到的模块，需要安装在静态资源目录下，例如：

```sh
/project
        /assets
              /node_modules   # client side node_modules
              /common
              /css
              - package.json  # 前端所依赖的模块声明
        /lib
        /controller
        /node_modules         # server side node_modules
        - package.json        # 后端所依赖的模块申明
```

## command line usage

```sh
# init project
cube init your_app_path

# start an http server
cube start your_app_path

```

## run with connect 集成到connect中

  假如你的工程已经是connect工程，或者express工程，那么可以很方便的将cube集成到工程中
  cube可以返回一个middleware方法 `middleware(req, res, next)`

```
  var Cube = require('node-cube');
  var middleware = Cube.init({
    root: '/wwwroot',  // static resource path, like wwwwroot below
    middleware: true  // run as a service, not return a middleware
  });js
  app.use('/static', middleware);
```
  ok, 访问你的调试环境  `http://localhost:port/static/xxx`, 静态资源+模块化支持

  `Cube.init(Object)` `Object` 可以包含以下参数
```
  {
    root: // 静态资源路径
    port: // 需要监听的端口
    middleware:  // 是否中间件模式
    base:  // 所有文件的前缀路径
    resBase:  // css中图片等资源的前缀路径
    scope:    // 模块的scope，like `@ali`, 暂未使用
    maxAge:   // 浏览器端文件缓存时间，最终会应用到http头：Cache-Control: public, maxAge=xxx
    processors: ['cube-ejs', 'cube-jade'] // load extra processors, 确保你的依赖中有这些模块
    devCache: // boolean 开发模式下是否开启缓存， 默认开启
  }
```
## 打包发布

进入生产环境之前，模块都会被预编译、压缩成一个个小文件，然后发布到线上(cdn服务器、云存储 或 其他)

```sh
# build static folder
cube build resource_path

# set up build_in_module ignore
cube build -i jquery,d3 resource_path
```

build参数:
```
  -h, --help                output usage information
  -p, --processors [value]  build in modules, tell cube ignore them, 关插件
  -o, --output [value]      set the output path  指定输出目录
  -b, --base [value]        set the cube base 指定代码库base
  --with-source             create source file 指定是否输出源文件
  -r, --resbase [value]     the http base for resouce 指定css中的资源文件 http路径的base
  --merge                   if merged dependences into on file 是否合并
```

在静态资源目录下，编写 `.cubeignore`来排除不需要被处理的文件，格式和.gitignore类似：

```
[skip]
/node_modules/jquery/jquery.min.js
[ignore]
/node_modules/.bin
```
- 匹配`skip`段的文件，将跳过编译，直接copy到目标目录
- 匹配`ignore`段的文件，将直接忽略，build之后不会出现在目标目录中

不添加标记的时候，默认都为skip, 例如：
```
/test/
```
cube 在build的时候将直接copy文件，而不会build代码

.cubeignore 文件的寻址 会从build目录开始逐级往上寻找，直到找到为止

## Cube的结构：客户端、服务端。

### Cube客户端  cube.min.js

就是一个loader，实现依赖按需加载。
在目标页面，加入`cube.min.js`脚本，浏览器多了一个 `window.Cube`对象。

### Cube服务端

Cube服务端有两种形态，可以是一个独立的http服务，如上面的例子；
也可以是一个中间件，组合到你的node程序中，指派路由，受理相应的静态资源请求

在服务端， Cube总共受理三种类型的文件：script, style, template

## Customize Cube Processors

一个典型的插件代码

```
var path = require('path');

function Processor(cube) {
   /*
    	cube: {

    		config,
    		fixupResPath
    		wrapTemplate,
    		processJsCode
    	}
    */
	this.cube = cube;
}
Processor.type = 'style';
Processor.ext = ['.sass'];
Processor.prototype.process = function (relpath, options, callback) {
	// get the source file abs path, so you can read the source
	var fpath = path.join(options.root, relpath);
	// do your processing
	return {

	}
};
```

## Hooks

### beforeResolvePath(originPath) 

支持处理require中原始的路径，如在特定的情况下将一个远程依赖改为本地依赖

```
Cube.init({
  // ...
  hooks: {
    beforeResolvePath: function(originPath) {
      if (/^\w+?:/.test(originPath)){
        var _path = path.join(this.root, originPath.split(':')[1]);
        if (fs.existsSync(_path)) {
          return _path.replace(this.root, '');
        }
      }
      return file;
    }
  }
});
```