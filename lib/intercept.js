const TransformerStream = require('./transformer-stream')

/**
 * @name bodyFn
 * @function
 * Function that transforms the body.
 *
 * @param {Buffer} buffer Buffer of the response's body
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {String|Buffer} Transformed data that will be sent to the client
 */

/**
 * @name headersFn
 * @function
 * Function that transforms the headers.
 *
 * @this {Object} Express response object
 * @return {Null}
 */

/**
 * Middleware-generating function that transforms requests
 *
 * @param {bodyFn} bodyFn
 * @param {headersFn} headersFn
 */
module.exports = (bodyFn, headersFn) => (req, res, next) => {
  const stream = new TransformerStream(bodyFn, req, res)

  const write = res.write.bind(res)
  const end = res.end.bind(res)
  const writeHead = res.writeHead.bind(res)

  stream.on('data', buffer => write(buffer))
  stream.on('end', end)

  res.write = (...args) => stream.write(...args)
  res.end = (...args) => stream.end(...args)

  res.writeHead = (code, headers) => {
    if (headersFn) headersFn.call(res)
    res.removeHeader('Content-Length')
    writeHead(code, headers)
  }

  next()
}
