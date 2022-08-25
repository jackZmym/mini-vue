'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/mini-jackz-vue.cjs.prod.js.js')
} else {
  module.exports = require('./dist/mini-jackz-vue.cjs.js.js')
}
