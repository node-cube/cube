/*!
 * cube: test/index.js
 * Authors  : = <=> (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
'use strict';

var expect = require('expect.js');
var testMod = require('../tools');
var path = require('path');
var fs = require('fs');
var Request = require('supertest');

describe('tools.js', function () {

  describe('processMerge()', function () {
    it('should return a js module with remote info', function () {
      let mockData = [
        {
          queryPath: 'a.js',
          realPath: 'a.js',
          requires: ['b.js', 'c.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'b.js',
          realPath: 'b.js',
          requires: ['d.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'c.js',
          realPath: 'c.js',
          requires: ['d.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'd.js',
          realPath: 'd.js',
          requires: [],
          requiresOrigin: []
        }
      ];

      let res = testMod._processMerge(mockData);
      expect(res.length).eql(1);
    });

    it('should return a js module with remote info', function () {
      let mockData = [
        {
          queryPath: 'a.js',
          realPath: 'a.js',
          requires: ['b.js', 'c.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'f.js',
          realPath: 'f.js',
          requires: ['c.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'b.js',
          realPath: 'b.js',
          requires: ['d.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'c.js',
          realPath: 'c.js',
          requires: ['d.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'd.js',
          realPath: 'd.js',
          requires: [],
          requiresOrigin: []
        }
      ];

      let res = testMod._processMerge(mockData);
      expect(res.length).eql(4);
    });

    it('should return a js module with remote info', function () {
      let mockData = [
        {
          queryPath: 'b.js',
          realPath: 'b.js',
          requires: ['c.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'd.js',
          realPath: 'd.js',
          requires: [],
          requiresOrigin: []
        },
        {
          queryPath: 'c.js',
          realPath: 'c.js',
          requires: ['d.js'],
          requiresOrigin: []
        },
        {
          queryPath: 'a.js',
          realPath: 'a.js',
          requires: ['b.js'],
          requiresOrigin: []
        },
      ];

      let res = testMod._processMerge(mockData);
      expect(res.length).eql(1);
      console.log(res);
    });
  });

});
