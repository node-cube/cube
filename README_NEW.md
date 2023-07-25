Cube 
--------------

## Cube运行

### 独立Server运行

```sh
# 启动一个cube的dev服务，监听到指定端口
cube run -p $port $static_root_path
```
详细配置见下方

### Middleware集成

```js
const Cube = require('node-cube');
// init cube middleware
let cubeMid = Cube.middleware(option);
// sample app
let app = Express();
// mount middleware
app.use('/asset', cubeMid)
```
详细配置见下方

### 构建目标代码

```sh
cube build $static_root_path -o $release_path
```
详细配置见下方

## Cube配置

cube的配置，可以来自两个地方:
* 在静态资源根目录的package.json -> cube 属性中配置 <优先级高>
* 在代码中new Cube的时候传入的option对象 <优先级高>

### option对象

```js
let option = {
  // 前端资源的绝对文件路径
  rootPath: "",
  // 前端资源的http访问的绝对路径（域名后完整的路径）, 注意，在middleware模式确保访问路径对齐
  // 主要是css资源的处理
  httpPath: "",
  // 各种类型的处理器
  processors: {
    // multi ext to the same processor
    ".js, .jsx, .ts, .tsx": "custom-processor",
    // multi processors in serial
    ".less": ["cube-less", "custom-css-processor"],
    // ext to processors with config(if needed), the config is applied by the processor
    ".less": [
      ["cube-less", {/* cube-less processor's config */}], 
      ["custom-css-processor", {/* custom processor plugin's config */}]
    ]
  },
  // 当前静态资源的命名空间，适用于多app的资源联合加载使用, ref to former opt.remote
  namespace: "",
}
```

### Cube.Server(servOption)

```js
Cube.
```


### 定制processor

cube支持4种类型的文件:
  * script
  * style
  * json


