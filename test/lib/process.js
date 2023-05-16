const should = require('should');

const Cube = require('../../lib/cube');

describe('lib/process.js', () => {
  describe.only("cube.transferCode()", () => {
    it('should wraper code fine with simple require(mod)', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `require('abc');`,
        wrap: true,
        cleanCache: true
      };
      cube.resolveModulePath = function(d, m) {
        return {
          modName: 'resolve_' + m
        };
      };
      cube.transferCode(data, (err, d) => {
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\(\'\/test\.js'/);
        code.should.match(/\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        done();
      })
    });
    

    it.only('should wraper code fine with simple require(mod)', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `describe('test/test_module', ()=>{let test = require('test');});`,
        wrap: true,
        cleanCache: true
      };
      cube.resolveModulePath = function(d, m) {
        return {
          modName: 'resolve_' + m
        };
      };
      cube.transferCode(data, (err, d) => {
        // console.log(err, d);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        console.log(code);
        code.should.match(/Cube\(\'\/test\.js'/);
        code.should.match(/\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        done();
      })
    });

    it('should work fine with async(mod, fn)', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `async('abc', function(mod) {mod.run();})`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {
          modName: 'resolve_' + m
        };
      };
      cube.transferCode(data, (err, d) => {
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        code.should.match(/Cube\('\/test\.js', \(/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/async\(['"]resolve_abc['"],/);
        done();
      })
    });

    it('should work fine with async(mod)', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `async('abc')`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        code.should.match(/Cube\('\/test\.js', \(/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        done();
      });
    });

    it('should work fine with anonymous import', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `import 'abc';`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/require\("resolve_abc"\)/);
        done();
      })
    });

    it('should work fine with import', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `import abc from 'abc';`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/const abc = require\("resolve_abc"\)._default/);
        done();
      })
    });

    it('should work fine with import alias', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `import {abc as def} from 'abc';def()`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        console.log(code);
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/const def = require\("resolve_abc"\).abc/);
        done();
      })
    });

    it('should work fine with namespace import', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `import * as named from 'abc';`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/const named = require\(['"]resolve_abc['"]\)/);
        done();
      })
    });

    it('should work fine with import alias ', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `import dExport, {default as dAlias, abc as nAlias} from 'abc';`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/dExport = require\("resolve_abc"\)._default/);
        code.should.match(/dAlias = require\("resolve_abc"\)._default/);
        code.should.match(/nAlias = require\("resolve_abc"\).abc/);
        done();
      })
    });

    it('should work fine with import string name ', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `import {'a-b' as alias} from 'abc';alias()`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        console.log(code);
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/alias = require\("resolve_abc"\)\['a-b'\]/);
        done();
      })
    });

    it('should work fine with import string name ', (done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `import {'a-b' as alias} from 'abc';alias()`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/alias = require\("resolve_abc"\)\['a-b'\]/);
        done();
      })
    });

    it('should work fine with export declarations let',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export let a=1, b`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/exports\.b/);
        code.should.match(/exports\.a ?= ?1/);
        done();
      })
    });

    it('should work fine with export declarations let',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `function bb(){}; export const a=1, b=bb`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/exports\.b ?= ?bb/);
        code.should.match(/exports\.a ?= ?1/);
        done();
      })
    });

    it('should work fine with export declarations let',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export function bb(a){}`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/exports\.bb ?= ?function bb ?\(a\) ?\{\}/);
        done();
      })
    });

    it('should work fine with export declarations let',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export class cls{}`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/exports\.cls ?= ?class cls ?\{\}/);
        done();
      })
    });

    it('should work fine with export declarations destruction',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export let {a, b:alias}=obj`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/exports\.a ?= ?obj.a/);
        done();
      })
    });

    it('should work fine with export list',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export {a, b as c, d as 'a-d'}`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/exports\.a ?= ?a/);
        code.should.match(/exports\.c ?= ?b/);
        code.should.match(/exports\['a-d'] ?= ?d/);
        done();
      })
    });

    it('should work fine with named export list',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export {a, b as c, d as 'a-d'}`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>\{/);
        code.should.match(/exports\.a ?= ?a/);
        code.should.match(/exports\.c ?= ?b/);
        code.should.match(/exports\['a-d'] ?= ?d/);
        done();
      })
    });

    it('should work fine with named export list from module',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export {b as c, d as 'a-d'} from 'abc'`,
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>/);
        code.should.match(/exports\.c ?= ?require\(['"]resolve_abc['"]\)\.b/);
        code.should.match(/exports\['a-d'\] ?= ?require\(['"]resolve_abc['"]\)\.d/);
        done();
      })
    });

    it('should work fine with named export default from module',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export {default} from 'abc'`, // exports._default = require('abc')._default;
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js', ?\['resolve_abc'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>/);
        code.should.match(/exports\._default ?= ?require\(['"]resolve_abc['"]\)\._default/);
        done();
      })
    });

    it('should work fine with named export * as ns from module',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export * as ns from "mod"`, // exports.ns = require('abc');
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js', ?\['resolve_mod'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>/);
        code.should.match(/exports\.ns ?= ?require\(['"]resolve_mod['"]\)/);
        done();
      })
    });

    it('should work fine with named export * from module',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export * from "mod"`, // exports.ns = require('abc');
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js', ?\['resolve_mod'\]/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>/);
        code.should.match(/module\.exports ?= ?require\(['"]resolve_mod['"]\)/);
        done();
      })
    });

    it('should work fine with named export default member',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export default mod`, // exports.ns = require('abc');
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>/);
        code.should.match(/exports._default ?= ?mod/);
        done();
      })
    });

    it('should work fine with named export default class',(done) => {
      let cube = new Cube({root: ''});
      let data = {
        queryPath: '/test.js',
        type: 'script',
        ext: '.jsx',
        targetExt: '.js',
        code: `export default class {}`, // exports.ns = require('abc');
        wrap: true
      };
      cube.resolveModulePath = function(d, m) {
        return {modName: 'resolve_' + m};
      };
      cube.transferCode(data, (err, d) => {
        should(err).eql(null);
        let code = d.code.replace(/( +)?\n( +)?/mg, '');
        // console.log(code);
        code.should.match(/Cube\('\/test\.js',/);
        code.should.match(/\(module, ?exports, ?require, ?async\)=>/);
        code.should.match(/exports._default ?= ?class/);
        done();
      })
    });
  })
});