# 🚀 Welcome to 响应系统的源码简版 -ZSM

This project has been created using **pnpm+monorepo+esbuild（dev）+rollup.js(build)**, you can now run

```
pnpm  build
```

or

```
pnpm dev
```

to bundle your application

# 
## vue3源码项目管理模式

### 采取 pnpm+monorepo++workspace

前端多个包管理的的方式一般都是采用`monorepo`的方式去管理，之前都是使用的`lerna`的workspace去管理。前段时间包管理切换到了`pnpm`上，它也有worksapce,可以支持`monorepo`。

### monorepo

Monorepo的意思是在版本控制系统的单个代码库里包含了许多项目的代码。这些项目虽然有可能是相关的，但通常在逻辑上是独立的，并由不同的团队维护。

在前端使用角度来看，monorepo 就是把多个工程放到一个 git 仓库中进行管理，因此他们可以共享同一套构建流程、代码规范也可以做到统一，特别是如果存在模块间的相互引用的情况，查看代码、修改bug、调试等会更加方便