const fs = require('fs')
const path = require('path')

const history = require('connect-history-api-fallback')
const httpProxy = require('http-proxy')

const intercept = require('./lib/intercept')

/**
 * @name isInterceptableFn
 * @function
 * Determines if a request is interceptable
 *
 * @param {Object} res
 * @return {Boolean} whether to intercept the request or not
 */

/**
 * Express middleware that serves single Page Apps and injects
 * asynchronously-generated variables in their HTML pages.
 *
 * In development: proxies and transforms the `devHost` host
 *
 * In production: transforms HTML, serves the rest as static and handles
 * HTML5 History fallbacks with @bripkens/connect-history-api-fallback
 *
 * @param {Object} express Uninstantialized Express module
 * @param {fnCallback} fn Function that either returns a value or a promise whose
 *   value will be injected in HTML pages. Receives the `req` object as argument.
 * @param {Object} [options]
 * @param {String} [options.devHost] Hostname of the server proxied in development
 * @param {String} [options.distPath] Path of the built static files
 * @param {String} [options.env] Environment to use. If not "production", will default to development
 * @param {String} [options.historyOptions] Options passed to connect-history-api-fallback
 * @param {isInterceptableFn} [options.isInterceptable] Determines if a response is interceptable
 * @param {String} [options.namespace] Name of the global variable the object will be injected in
 */
module.exports = function spaInjector (express, fn, options = {}) {
  const {
    devHost,
    distPath,
    env,
    historyOptions,
    isInterceptable,
    routes,
    namespace
  } = Object.assign({
    devHost: 'http://localhost:8080/',
    distPath: './dist',
    env: process.env.NODE_ENV,
    historyOptions: {},
    isInterceptable: res => /text\/html/.test(res.get('Content-Type')),
    routes: [],
    namespace: 'globals'
  }, options)

  if (!(fn instanceof Function)) throw new Error('Argument "fn" should be a function')
  if (!distPath) throw new Error('Argument "distPath" must be defined')

  // Injects the object returned by the promise returned by fn()
  // in window[namespace] by wrapping it in a script tag
  const inject = async (html, req) => {
    const obj = await fn(req)
    const tag = `<script>window['${namespace}'] = ${JSON.stringify(obj) || '{}'};</script>`

    const index = html.indexOf('</head>')
    if (index < 0) return html

    return html.slice(0, index) + '\n\n' + tag + '\n' + html.slice(index)
  }

  // Create the middleware that will be returned
  const middleware = express.Router()

  // HTML5 History fallback in production
  if (env === 'production') middleware.use(history(historyOptions))

  // Inject fn() results in body before </head> and remove etag header
  const interceptor = intercept(function bodyFn (buffer, req, res) {
    return isInterceptable(res) ? inject(buffer.toString(), req) : buffer
  }, function headersFn () {
    if (isInterceptable(this)) {
      this.removeHeader('ETag')
      this.removeHeader('etag')
    }
  })

  if (routes.length > 0) {
    for (let route of routes) {
      middleware.get(route, interceptor)
    }
  } else {
    middleware.use(interceptor)
  }

  if (env === 'production') {
    middleware.use(express.static(distPath))
  } else {
    const proxy = httpProxy.createProxyServer({ target: devHost })
    middleware.use((req, res) => proxy.web(req, res))
  }

  return middleware
}
