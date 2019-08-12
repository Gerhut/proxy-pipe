const { readFile, writeFile } = require('fs')
const { join } = require('path')
const { promisify } = require('util')

const mkdirp = require('mkdirp')
const express = require('express')
const proxy = require('express-http-proxy')
const debug = require('debug')('proxy-pipe')

const readFilePromise = promisify(readFile)
const writeFilePromise = promisify(writeFile)

const app = module.exports = express()

const getContentCacheFilename = url => join(process.env.CACHE, encodeURIComponent(url))

app.use(proxy('https://github.com', {
  async filter (req, res) {
    try {
      const filename = getContentCacheFilename(req.url)
      const content = await readFilePromise(filename)
      debug('Cache HIT', req.url)
      res.send(content)
      return false
    } catch (err) {
      if (err.code !== 'ENOENT') {
        debug('Cache ERROR', req.url, err)
      } else {
        debug('Cache MISS', req.url)
      }
      return true
    }
  },
  async userResDecorator (proxyRes, proxyResData, userReq) {
    if (proxyRes.statusCode === 200) {
      try {
        const filename = getContentCacheFilename(userReq.url)
        await writeFilePromise(filename, proxyResData)
        debug('Cached', userReq.url)
      } catch (err) {
        debug('Cached ERROR', userReq.url, err)
      }
    }
    return proxyResData
  }
}))

if (require.main === module) {
  mkdirp.sync(process.env.CACHE)
  app.listen(process.env.PORT, process.env.HOST)
}
