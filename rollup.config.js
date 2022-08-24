import path from 'path'
import json from '@rollup/plugin-json'
import ts from 'rollup-plugin-typescript2'
import resolvePlugin from '@rollup/plugin-node-resolve'

const packageName = process.env.TARGET // 脚本文件中build函数传递过来的自定义环境变量
const packagesPath = path.resolve(__dirname, 'packages') // packages path
const packageDirPath = path.resolve(packagesPath, packageName) // packages 每个包的 path
const resolve = p => path.resolve(packageDirPath, p)
const packageJSON = require(resolve('package.json'))

const outputConfigs = {
  'esm-bundler': {
    file: resolve(`dist/${packageName}.esm-bundler.js`),
    format: 'es'
  },
  cjs: {
    file: resolve(`dist/${packageName}.cjs.js`),
    format: 'cjs'
  },
  global: {
    file: resolve(`dist/${packageName}.global.js`),
    format: 'iife'
  }
}

const packageOptions = packageJSON.buildOptions

function createConfig(format, output) {
  output.name = packageOptions.name
  output.sourcemap = packageOptions.sourcemap

  return {
    input: resolve(`src/index.ts`),
    output,
    plugins: [
      json(),
      ts({
        tsconfig: path.resolve(__dirname, 'tsconfig.json')
      }),
      resolvePlugin()
    ]
  }
}
function createProductionConfig(format) {
  return createConfig(format, {
    file: resolve(`dist/${packageName}.${format}.prod.js`),
    format: outputConfigs[format].format
  })
}
const packageFormats = packageOptions.formats
const packageConfigs = process.env.PROD_ONLY
  ? []
  : packageFormats.map(format => createConfig(format, outputConfigs[format]))
if (process.env.NODE_ENV === 'production') {
  packageFormats.forEach(format => {
    if (packageOptions.prod === false) {
      return
    }
    if (format === 'cjs') {
      packageConfigs.push(createProductionConfig(format))
    }
  })
}
export default packageConfigs
