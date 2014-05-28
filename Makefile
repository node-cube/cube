UG := node_modules/.bin/uglifyjs

install:
	@npm install .
release:
	@$(UG) cube.js -c -o cube.min.js

.PHONY:
	install