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

###  Vue3的项目结构

- **`reactivity`**:响应式系统
- **`runtime-core`**:与平台无关的运行时核心 (可以创建针对特定平台的运行时 - 自定义渲染器)
- **`runtime-dom`**: 针对浏览器的运行时。包括`DOM API`，属性，事件处理等
- **`runtime-test`**:用于测试
- **`server-renderer`**:用于服务器端渲染
- **`compiler-core`**:与平台无关的编译器核心
- **`compiler-dom`**: 针对浏览器的编译模块
- **`compiler-ssr`**: 针对服务端渲染的编译模块
- **`compiler-sfc`**: 针对单文件解析
- **`size-check`**:用来测试代码体积
- **`template-explorer`**：用于调试编译器输出的开发工具
- **`shared`**：多个包之间共享的内容
- **`vue`**:完整版本,包括运行时和编译器
- **`reactivity Transform `**:反应性转换是特定于 Composition-API 的功能(目前是一个实验性功能。默认情况下它是禁用的)
- **`scripts`**:运行脚本-打包本地开发环境测试包 生产环境包以及 版本发布

![5712687-a46994853f435995](https://tva1.sinaimg.cn/large/e6c9d24egy1h5j2tlwthbj213w0mc75g.jpg)