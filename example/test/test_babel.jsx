'use strict';
class A {
  constructor () {
    return 'hello'; // <test>hello jsx!</test>;
  }
}

class B extends A {
  constructor () {
    super();
    console.log('hello');
  }
}

module.exports = B;
