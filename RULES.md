规则列表

## cube看文件的规则

  文件名.suffix
  文件名 + 类型寻址


## 文件类型
cube 定义几种类型的文件:

  * script
  * style
  * tpl
  * raw


## 文件规则

### require寻址

1. js, coffee 可以不带后最，cube会自动寻址
2. 模板文件，样式文件，都需要带上后最

## url直接访问寻址

1. 识别文件类型，
2. 寻找原文件，如果原文件匹配，则直接命中源文件
3. 寻找同一类型的文件

** url直接访问的时候，尽可能使用 基本类型访问: .js  .css

## 服务寻址规则

* 当浏览器直接访问文件时，Literal
* 当浏览器访问带  query.m == true,   transfer

##


### 处理逻辑

  * flag wrap  表示需要对输出做wrap处理
  * flag minify 表示需要压缩输出
  * flag release 表示build输出，需要对文件名做静态化处理
    * build输出不做文件名混淆
    * build输出最下化


两种模式
  * dev:
    用户请求 -> 检查缓存 -> 文件寻址 -> 进入processors(pipe) -> 输出 -> 缓存
      缓存策略采用:
        cache所有的单文件，启动时分析文件依赖树
      加载

  * release:

###