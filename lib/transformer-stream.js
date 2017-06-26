const Stream = require('stream')

module.exports = class TransformerStream extends Stream {
  constructor (fn, req, res) {
    super()

    this.fn = fn
    this.req = req
    this.res = res
    this.readable = true
    this.writable = true
    this.chunks = []
  }

  get buffer () {
    return Buffer.concat(this.chunks)
  }

  write (data) {
    this.chunks.push(data)
  }

  async end () {
    const data = await Promise.resolve(this.fn(this.buffer, this.req, this.res))

    this.emit('data', data)
    this.emit('end')
  }
}
