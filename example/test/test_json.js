'use strict';

describe('test json', () => {
  it('should work fine', function () {
    expect(require('./test_json.json')).eql({});
  });
});