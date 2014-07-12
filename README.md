Cube
=================

![logo](https://raw.github.com/fishbar/cube/master/logo.png)

像node.js一样编写浏览器端代码，无需争端AMD、还是CMD，只是build方式的不同，重要的是书写方便、简洁。

Cube提供一个http服务的能力，源码上支持js, coffee, less, styl, ejs, jade。
Cube会将这些语言，转换为服务于web的js 和 css

## install

  npm install -g node-cube

## init

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

  cube的初始化就从这个wwwroot开始，进入wwwroot目录，cube内建静态资源服务，启动服务:

```sh
  cd static_dir
  # 初始化工程
  cube init  // --jade 启用jade, --ejs 启用ejs
  # 启动静态服务
  cube start
```

  根据命令行提示的地址访问, ok，你的前端资源可以像node.js一样编写了。

  在设计前端框架的时候，通常都会考虑到这点：前端资源需要可以被方便的部署到CDN等资源（动静态资源分离）
  cube的运行模式就是遵循这一设计思路的

## 集成到项目的connect中

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


## 编写一个模块

```js
// header.js
var cookie = require('cookie');
function  init() {
  var nick = cookie.get('nick');
  if (!nick) {
    nick = 'guest';
  }
  $('node-nick').text(nick);
}

init();
// 异步加载脚本
async('./tset.tpl', function(render) {
  render({appName: "cube"});
});
// 异步加载css
async('../css/module.css', nameSpace); // namespace: prefix for css selector
```
ok，一个很简单的一个模块，设置头部用户登录昵称

模块加载是支持像node一样寻址node_modules目录的，在wwwroot目录下安装模块，可以被直接require使用， 所以把你的代码写好了，发布到npm公用吧！

引用现有的包， 你只需要 (a)编写好package依赖 (b) `npm install` (c) 像node一样引用这些模块

## 部署浏览器端

```html
<script src='/cube.js'></script>
<script>
  Cube.init({
    charset: 'utf-8',
    base: '/project/static/',  // virtual path, base can be cdn server: http://tbcdn.cn/edp/
    debug: true,               // online module ,you should turn off this switch
    enableCss: true,           // enable dynamic loading css resource
    version: 12345,            // the code version, used for flushing client side script
    timeout: 2000              // loading script timeout setup
  });
  Cube.use(appConfig.main, function (App) {
    console.log(App.run(appConfig));
  });
</script>
```

## 优化加载

  模块化之后带来的一个问题，就是文件非常零碎，有时候甚至影响到了执行性能。
  这个时候可以通过 `@merge` 这个标记来优化文件

```js
/**
 * file description
 * @merge
 */
var a = require('a');
var b = require('b');
var c = require('c');
```
  通过标记`@merge`, 服务器会将`a`,`b`,`c`三个模块合并到当前模块的文件中，一起输出。
  通过这个方法，可以将整个app中常用的一些模块打包成一个文件

## 打包发布

进入生产环境之前，模块都会被预编译、压缩成一个个小文件，然后发布到线上(cdn服务器、云存储 或 其他)

```sh
cube build resource_path
```

在静态资源目录下，编写 `.cubeignore`来排除不需要被处理的文件，格式和.gitignore一样