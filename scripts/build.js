const fs = require('fs-extra')
const path = require('path')
// 开启子进程打包，最终还是使用rollup来进行打包
const execa = require('execa')
const args = require('minimist')(process.argv.slice(2))
const formats = args.formats || args.f
const devOnly = args.devOnly || args.d
const { targets: allTargets } = require('./utils')
// 对目标依次、并行打包
async function build(target) {
  const pkgDir = path.resolve(`packages/${target}`)
  const pkg = require(`${pkgDir}/package.json`)
  // if building a specific format, do not remove dist.
  if (!formats) {
    await fs.remove(`${pkgDir}/dist`)
  }
  const env =
    (pkg.buildOptions && pkg.buildOptions.env) ||
    (devOnly ? 'development' : 'production')
  // rollup  -c --environment TARGET:shated
  await execa(
    'rollup',
    [
      '-c',
      '--environment',
      [`NODE_ENV:${env}`, `TARGET:${target}`].filter(Boolean).join(',')
    ],
    {
      stdio: 'inherit'
    }
  ) // 当子进程打包的信息共享给父进程
}

function runParallel(targets, iteratorFn) {
  const res = []
  for (const item of targets) {
    const p = iteratorFn(item)
    res.push(p)
  }
  return Promise.all(res)
}

runParallel(allTargets, build)
