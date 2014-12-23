Cube
=================

![logo](https://raw.github.com/fishbar/cube/master/logo.png)

像node.js一样编写浏览器端代码, 方便、简洁。 Cube自动转换你的代码，你只需要关心业务逻辑。
Cube支持的格式包括 script(js/coffee), style(css/stylus/less) template(html/ejs/jade)

[![Build Status](https://travis-ci.org/node-cube/cube.svg)](https://travis-ci.org/node-cube/cube)
[![NPM version](https://badge.fury.io/js/node-cube.svg)](http://badge.fury.io/js/node-cube)

## Install

  npm install -g node-cube

## Getting Start

初始化cube，通过cube命令，生成工程结构，包含 `cube.min.js`，`index.html`

```sh
> cd your_project_dir
> cube init
```

查看`index.html`, cube 客户端的部署大致如下
```html
<script src='cube.min.js'></script>
<script>
  Cube.init({
    charset: 'utf-8',
    base: '/',  // virtual path, base can be a http path: http://domain.com/project/static
    debug: true,               // online module ,you should turn off this switch
    enableCss: true,           // enable dynamic loading css resource
    version: 12345,            // the code version, used for flushing client side script
    timeout: 15000              // loading script timeout setup
  });
  Cube.use('/main.js', function (App) {
    console.log(App.run(appConfig));
  });
</script>
```
启动cube服务
```sh
> cube start
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

```js
  var Cube = require('node-cube');
  var middleware = Cube.init({
    root: '/wwwroot',  // static resource path, like wwwwroot below
    middleware: true  // run as a service, not return a middleware
  });
  app.use('/static', middleware);
```
  ok, 访问你的调试环境  `http://localhost:port/static/xxx`, 静态资源+模块化支持

  `Cube.init(Object)` `Object` 可以包含以下参数
```
  {
    root:
    port:
    middleware:
    base:
    http:
    scope:
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

在静态资源目录下，编写 `.cubeignore`来排除不需要被处理的文件，格式和.gitignore一样

## Cube的结构：客户端、服务端。

### Cube客户端  cube.min.js

就是一个loader，实现依赖按需加载。
在目标页面，加入`cube.min.js`脚本，浏览器多了一个 `window.Cube`对象。

### Cube服务端

Cube服务端有两种形态，可以是一个独立的http服务，如上面的例子；
也可以是一个中间件，组合到你的node程序中，指派路由，受理相应的静态资源请求

在服务端， Cube总共受理三种类型的文件：script, style, template

## Customize Cube Processors

...

## why cube

  每一个web应用都有一包静态资源
  每一个web应用的静态资源，都应该被设计成可自由部署 (static.server/path, 虽然很多时候静态资源都在同域下)
  每一个web应用都会包含这么一个目录叫静态资源, 比如:

```sh
  webapp -|
          | - wwwroot | << 静态资源目录
                      | - js
                      | - css
                      | - imgs
```
  在设计前端框架的时候，通常都会考虑到这点：前端资源需要可以被方便的部署到CDN等资源（动静态资源分离）
  cube的运行模式就是遵循这一设计思路的

  cube的初始化就从这个wwwroot开始，进入wwwroot目录，cube内建静态资源服务，启动服务:

  根据命令行提示的地址访问, ok，你的前端资源可以像node.js一样编写了。

  cube让前端开发模块化，更好的代码组织方式，让代码轻松复用。
  cube集成各种工具，让coffee，styl，jade，ejs，less等等默认支持，选择你所熟悉的工具。
  cube支持扩展，你可以动手集成插件进入其中。

