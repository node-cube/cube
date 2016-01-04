UG := node_modules/.bin/uglifyjs

install:
	@npm install .

release:
	@$(UG) ./runtime/cube.js -c -m -o ./runtime/cube.min.js
	@node ./bin/version.js
	@$(UG) ./runtime/ejs_runtime.js -m -o ./runtime/ejs_runtime.min.js
	@$(UG) ./runtime/jade_runtime.js -m -o ./runtime/jade_runtime.min.js
	@$(UG) ./runtime/cube_css.js -m -o ./runtime/cube_css.min.js

publish: release tag
	@npm publish

tag:
	@cat package.json | awk -F '"' '/version" *: *"/{print "v"$$4}' | xargs -I {} git tag {}

test:
	@npm run test

test-cov:
	@npm run testcov

.PHONY: \
	install release publish test test-cov tag
