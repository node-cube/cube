UG := node_modules/.bin/uglifyjs

install:
	@npm install .
release:
	@$(UG) ./runtime/cube.js -c -m -o ./runtime/cube.min.js
	@$(UG) ./runtime/ejs_runtime.js -m -o ./runtime/ejs_runtime.min.js
	@$(UG) ./runtime/jade_runtime.js -m -o ./runtime/jade_runtime.min.js
	@npm publish

.PHONY:
	install
