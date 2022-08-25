const args = require('minimist')(process.argv.slice(2))
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const semver = require('semver')
const currentVersion = require('../package.json').version
const { prompt } = require('enquirer')
const execa = require('execa')
// 当前版本 或者指定版本
const preId =
  args.preid ||
  (semver.prerelease(currentVersion) && semver.prerelease(currentVersion)[0])
//是否发布 命令行传参 --dry
const isDryRun = args.dry
// 是否跳过test测试流程
const skipTests = args.skipTests
//是否跳过build生产包
const skipBuild = args.skipBuild
//所有的包名
const packages = fs
  .readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => !p.endsWith('.ts') && !p.startsWith('.'))
//跳过发布的包
const skippedPackages = []
// 版本号对应+1位置 version 1.0.0
const versionIncrements = [
  'patch',
  'minor',
  'major',
  ...(preId ? ['prepatch', 'preminor', 'premajor', 'prerelease'] : [])
]
// 输出 对应方式的 版本名 version 1.0.0
const inc = i => semver.inc(currentVersion, i, preId)
//执行依赖包的bin
const bin = name => path.resolve(__dirname, '../node_modules/.bin/' + name)
// 运行bin命令
const run = (bin, args, opts = {}) =>
  execa(bin, args, { stdio: 'inherit', ...opts })
//控制台输出 类似预执行
const dryRun = (bin, args, opts = {}) =>
  console.log(chalk.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts)
//执行方式
const runIfNotDry = isDryRun ? dryRun : run
//获取包名地址
const getPkgRoot = pkg => path.resolve(__dirname, '../packages/' + pkg)
//控制台输出语言
const step = msg => console.log(chalk.cyan(msg))

//主流程
async function main() {
  let targetVersion = args._[0]
  //命令行传参 是否带有指定版本号
  if (!targetVersion) {
    // no explicit version, offer suggestions
    const { release } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements.map(i => `${i} (${inc(i)})`).concat(['custom'])
    })

    if (release === 'custom') {
      targetVersion = (
        await prompt({
          type: 'input',
          name: 'version',
          message: 'Input custom version',
          initial: currentVersion
        })
      ).version
    } else {
      targetVersion = release.match(/\((.*)\)/)[1]
    }
  }

  if (!semver.valid(targetVersion)) {
    //传参的版本号不对
    throw new Error(`invalid target version: ${targetVersion}`)
  }
  // 请选择版本
  const { yes } = await prompt({
    type: 'confirm',
    name: 'yes',
    message: `Releasing v${targetVersion}. Confirm?`
  })
  // no 直接 return
  if (!yes) {
    return
  }

  // run tests before release
  step('\nRunning tests...')
  if (!skipTests && !isDryRun) {
    await run(bin('jest'), ['--clearCache'])
    // await run('pnpm', ['test', '--bail'])
  } else {
    console.log(`(skipped)`)
  }

  // update all package versions and inter-dependencies
  step('\nUpdating cross dependencies...')
  updateVersions(targetVersion)

  // build all packages with types
  step('\nBuilding all packages...')
  if (!skipBuild && !isDryRun) {
    await run('pnpm', ['run', 'build', '--release'])
    // test generated dts files
    step('\nVerifying type declarations...')
    // await run('pnpm', ['run', 'test-dts-only'])
  } else {
    console.log(`(skipped)`)
  }

  // generate changelog
  step('\nGenerating changelog...')
  //   await run(`pnpm`, ['run', 'changelog'])

  // update pnpm-lock.yaml
  step('\nUpdating lockfile...')
  await run(`pnpm`, ['install', '--prefer-offline'])

  const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })
  if (stdout) {
    step('\nCommitting changes...')
    await runIfNotDry('git', ['add', '-A'])
    await runIfNotDry('git', ['commit', '-m', `release: v${targetVersion}`])
  } else {
    console.log('No changes to commit.')
  }

  // publish packages
  step('\nPublishing packages...')
  for (const pkg of packages) {
    await publishPackage(pkg, targetVersion, runIfNotDry)
  }

  // push to GitHub
  step('\nPushing to GitHub...')
  await runIfNotDry('git', ['tag', `v${targetVersion}`])
  await runIfNotDry('git', ['push', 'origin', `refs/tags/v${targetVersion}`])
  await runIfNotDry('git', ['push'])

  if (isDryRun) {
    console.log(`\nDry run finished - run git diff to see package changes.`)
  }

  if (skippedPackages.length) {
    console.log(
      chalk.yellow(
        `The following packages are skipped and NOT published:\n- ${skippedPackages.join(
          '\n- '
        )}`
      )
    )
  }
  console.log()
}
//更新包
function updateVersions(version) {
  // 1. update root package.json
  updatePackage(path.resolve(__dirname, '..'), version)
  // 2. update all packages
  packages.forEach(p => updatePackage(getPkgRoot(p), version))
}
//更新各个包版本以及依赖
function updatePackage(pkgRoot, version) {
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.version = version
  updateDeps(pkg, 'dependencies', version)
  updateDeps(pkg, 'peerDependencies', version)
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function updateDeps(pkg, depType, version) {
  const deps = pkg[depType]
  if (!deps) return
  Object.keys(deps).forEach(dep => {
    if (
      dep === 'mini-jackz-vue' ||
      (dep.startsWith('@mini-jackz-vue') &&
        packages.includes(dep.replace(/^@mini-jackz-vue\//, '')))
    ) {
      console.log(
        chalk.yellow(`${pkg.name} -> ${depType} -> ${dep}@${version}`)
      )
      deps[dep] = version
    }
  })
}
//发布npm包
async function publishPackage(pkgName, version, runIfNotDry) {
  if (skippedPackages.includes(pkgName)) {
    return
  }
  const pkgRoot = getPkgRoot(pkgName)
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  if (pkg.private) {
    return
  }

  let releaseTag = null
  if (args.tag) {
    releaseTag = args.tag
  } else if (version.includes('alpha')) {
    releaseTag = 'alpha'
  } else if (version.includes('beta')) {
    releaseTag = 'beta'
  } else if (version.includes('rc')) {
    releaseTag = 'rc'
  }

  step(`Publishing ${pkgName}...`)
  try {
    await runIfNotDry(
      // note: use of yarn is intentional here as we rely on its publishing
      // behavior.
      'yarn',
      [
        'publish',
        '--new-version',
        version,
        ...(releaseTag ? ['--tag', releaseTag] : []),
        '--access',
        'public'
      ],
      {
        cwd: pkgRoot,
        stdio: 'pipe'
      }
    )
    console.log(chalk.green(`Successfully published ${pkgName}@${version}`))
  } catch (e) {
    if (e.stderr.match(/previously published/)) {
      console.log(chalk.red(`Skipping already published: ${pkgName}`))
    } else {
      throw e
    }
  }
}

main().catch(err => {
  updateVersions(currentVersion)
  console.error(err)
})
