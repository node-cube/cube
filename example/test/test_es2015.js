class Point {

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  toString() {
    return `(${this.x}, ${this.y})`;
  }

  arrayFunction() {
    return () => {};
  }

  object() {
    let a = 1, b = 2;
    return {
      a,
      b
    };
  }

}