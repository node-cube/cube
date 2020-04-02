describe('test/test_cycle_require', () => {
  cache = []
  originWarn = ''
  before(() => {
    originWarn = console.warn
    console.warn = (msg, msg2) => {
      cache.push(msg + msg2);
    };
  })

  afterEach(() => {
    console.warn = originWarn
    cache = []
  })

  it.skip('expect console.warn info', (done) => {
    load('./cycle/a', () => {
      expect(cache[0]).to.match(/cycle/)
      done()
    })
  })
})
