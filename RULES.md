规则列表

## 文件类型
cube 定义3种类型的文件: script, style, tpl

同类型内，一般不会出现重名的现象

## 文件规则

### require寻址

1. js, coffee 可以不带后最，cube会自动寻址
2. 模板文件，样式文件，都需要带上后最

## url直接访问寻址

1. 识别文件类型，
2. 寻找原文件，如果原文件匹配，则直接命中源文件
3. 寻找同一类型的文件

** url直接访问的时候，尽可能使用 基本类型访问: .js  .css

## 编译寻址

网页直接引用时，不需要更改地址

1. js -> .js, coffee -> .js
2. css -> css,  less -> css,  styl -> css,...
          css.js        less.js       styl.js
3. jade -> jade.js, ejs -> ejs.js