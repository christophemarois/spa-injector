const fs = require('fs')
const path = require('path')
const url = require('url')

const httpProxy = require('http-proxy')
const fetch = require('node-fetch')

/**
 * Express middleware that serves single Page Apps and injects
 * asynchronously-generated variables in their HTML pages.
 *
 * @param {Function} fn Function that either returns a value or a promise whose
 *   value will be injected in HTML pages. Receives the `req` object as argument.
 * @param {Function} express Uninstantialized Express module
 * @param {Object} [options]
 * @param {String} [options.devHost] Hostname of the server proxied in development
 * @param {String} [options.distPath] Path of the built static files
 * @param {String} [options.entry] Entry filename
 * @param {String} [options.env] Environment to use. If not "production", will default to development
 * @param {String} [options.namespace] Name of the global variable the object will be injected in
 */
module.exports = function spaInjector (fn, express, options = {}) {
  if (!(fn instanceof Function)) throw new Error('Argument "fn" should be a function')
  if (!(express instanceof Function)) throw new Error('Argument "express" should be a function')

  const { devHost, devPath, distPath, env, entry, routes, namespace } = Object.assign({
    devHost: 'http://localhost:8080/',
    distPath: './client/dist',
    entry: 'index.html',
    env: process.env.NODE_ENV,
    routes: ['/'],
    namespace: 'static'
  }, options)

  let entryHtml

  // If we're in production, read the production HTML from filesystem
  if (env === 'production') {
    const entryFilePath = path.resolve(distPath, entry)

    try {
      entryHtml = fs.readFileSync(entryFilePath, 'utf-8')
    } catch (err) {
      throw new Error(`Could not read entry file "${entryFilePath}"`)
    }
  }

  // Create the middleware that will be returned
  const middleware = express.Router()

  // Injects the object returned by the promise returned by fn()
  // in window[namespace] by wrapping it in a script tag
  const serveAndTransformEntry = async (req, res, next) => {
    if (!entryHtml) {
      const entryFileUrl = url.resolve(devHost, entry)
      entryHtml = await fetch(entryFileUrl).then(resp => resp.text())
    }

    let html = entryHtml

    const json = JSON.stringify(await fn()) || '{}'
    const tag = `<script>;window['${namespace}'] = ${json};</script>`

    const index = html.indexOf('</head>')

    if (index >= 0) {
      html = html.slice(0, index) + '\n\n' + tag + '\n' + html.slice(index)
    } else {
      throw new Error(`No </head> found in "${entryFilePath}"`)
    }

    res.removeHeader('etag')
    res.status(200).send(html)
  }

  for (let route of routes) {
    middleware.get(route, serveAndTransformEntry)
  }

  if (env === 'production') {
    middleware.use(express.static(distPath))
  } else {
    const proxy = httpProxy.createProxyServer({ target: devHost })
    middleware.use((req, res) => proxy.web(req, res))
  }

  return middleware
}
