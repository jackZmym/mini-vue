import { extend } from '@mini-vue/shared'

// 用于保存正在执行的 ReactiveEffect 类的实例
export let activeEffect: ReactiveEffect | undefined

// 用于记录是否应该收集依赖，防止调用 stop 后触发响应式对象的 property 的 get 时收集依赖
export let shouldTrack: boolean = false

// 抽离出一个 ReactiveEffect 类，对相关操作进行封装
export class ReactiveEffect {
  private _fn: any
  // 用于保存与当前实例相关的响应式对象的 property 对应的 Set 实例
  deps: Array<Set<ReactiveEffect>> = []
  // 用于记录当前实例状态，为 true 时未调用 stop 方法，否则已调用，防止重复调用 stop 方法
  active: boolean = true
  // 内嵌时上一个的activeEffect
  parent: ReactiveEffect | undefined = undefined
  // 防止内部调用 无法stop该副作用
  private deferStop?: boolean = false
  constructor(fn, public scheduler?) {
    // 将传入的函数赋值给实例的私有 property _fn
    this._fn = fn
  }
  // 执行传入的函数
  run() {
    // 若已调用 stop 方法则直接返回传入的函数执行的结果
    if (!this.active) {
      return this._fn()
    }
    // 当前保存完的副作用函数
    let parent: ReactiveEffect | undefined = activeEffect
    // 防止内嵌产生导致外层依赖无法收集
    let lastShouldTrack = shouldTrack
    while (parent) {
      // 处理 内层触发外层的副作用函数 setter导致 外层依赖值一直改变造成爆栈
      if (parent === this) {
        return
      }
      parent = parent.parent
    }
    // debugger;
    try {
      // 存储上一个存在的activeEffect（内嵌时）
      this.parent = activeEffect
      // 应该收集依赖
      shouldTrack = true
      // 调用 run 方法时，用全局变量 activeEffect 保存当前实例
      activeEffect = this as any
      // 执行前清除依赖
      cleanupEffect(this)
      //执行副作用函数 触发收集依赖
      const res = this._fn()
      // 返回传入的函数执行的结果
      return res
    } finally {
      // 执行完当前副作用函数后 储存当前的实例为上一个副作用函数
      activeEffect = this.parent
      // 重置
      shouldTrack = lastShouldTrack

      this.parent = undefined
      // 防止内部调用stop后 再收集依赖 effect.deps更新了 最后副作用函数完成时依赖未完全清除时 导致清除无效
      if (this.deferStop) {
        this.stop()
      }
    }
  }
  onStop?: () => void
  // 用于停止传入的函数的执行
  stop() {
    // 判断此时是内部调用
    if (activeEffect == this) {
      this.deferStop = true
    } else if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

// 接受一个函数作为参数
export function effect(fn, options: any = {}) {
  // 利用传入的函数创建 ReactiveEffect 类的实例
  const _effect: ReactiveEffect = new ReactiveEffect(fn)
  // 将第二个参数即 options 对象的属性和方法挂载到 ReactiveEffect 类的实例上
  extend(_effect, options)
  // 调用 ReactiveEffect 实例的 run 方法，执行传入的函数
  if (!options || !options.lazy) {
    _effect.run()
  }
  // 用一个变量 runner 保存将 _effect.run 的 this 指向指定为 _effect 的结果
  const runner: any = _effect.run.bind(_effect)
  // 将 _effect 赋值给 runner 的 effect property
  runner.effect = _effect
  // 返回 runner
  return runner
}
/**
 * 用于保存程序运行中的所有依赖
 * key 为响应式对象
 * value 为 Map 的实例，用于保存该响应式对象的所有依赖
 */
const targetsMap = new WeakMap()

// 用于收集依赖
export function track(target, key) {
  // 获取当前响应式对象对应的 Map 实例,若为 undefined 则进行初始化并保存到 targetsMap 中
  /**
   * 用于保存当前响应式对象的所有依赖
   * key 为响应式对象的 property
   * value 为 Set 的实例，用于保存与该 property 相关的 ReactiveEffect 类的实例
   */
  // 若不应该收集依赖则直接返回 用于判断是否应该收集依赖
  if (!(shouldTrack && activeEffect)) {
    return
  }
  let depsMap: Map<any, Set<ReactiveEffect>> | undefined =
    targetsMap.get(target)

  if (!depsMap) {
    depsMap = new Map<any, Set<ReactiveEffect>>()
    targetsMap.set(target, depsMap)
  }

  // 获取当前 property 对应的 Set 实例，若为 undefined 则进行初始化并保存到 depsMap 中
  /**
   * 用于保存与当前 property 相关的函数
   * value 为与该 property 相关的 ReactiveEffect 类的实例
   */
  let dep: Set<ReactiveEffect> | undefined = depsMap.get(key)

  if (!dep) {
    dep = new Set<ReactiveEffect>()
    depsMap.set(key, dep)
  }
  trackEffects(dep)
}
// 用于将当前正在执行的 ReactiveEffect 类的实例添加到 dep 中， 同时将 dep 添加到当前正在执行的 ReactiveEffect 类的实例的 deps property 中
export function trackEffects(dep) {
  // 若 dep 中包括当前正在执行的 ReactiveEffect 类的实例则直接返回
  if (dep.has(activeEffect!)) {
    return
  }
  // 将当前正在执行的 ReactiveEffect 类的实例添加到 dep 中
  dep.add(activeEffect!)
  // 将 dep 添加到当前正在执行的 ReactiveEffect 类的实例的 deps property 中
  activeEffect!.deps.push(dep)
}
// 用于触发依赖
export function trigger(target, key) {
  // debugger;
  // 获取当前响应式对象对应的 Map 实例
  const depsMap: Map<any, Set<ReactiveEffect>> = targetsMap?.get(target)
  // 获取当前 property 对应的 Set 实例
  const dep: Set<ReactiveEffect> = depsMap?.get(key)!
  if (!depsMap || !dep) {
    return
  }
  /**
   * 遍历 dep，判断每一个 ReactiveEffect 类的实例的 scheduler property 是否存在
   * 若不为 undefined 则调用 scheduler 方法，否则调用 run 方法
   */

  triggerEffects(dep)
}
// 用于遍历 dep，调用每一个 ReactiveEffect 类的实例的 scheduler 方法或 run 方法
export function triggerEffects(dep) {
  // 执行副作用函数Set时 正分支切换删除对应依赖
  let effects: Set<ReactiveEffect> = new Set(dep)
  for (const reactiveEffect of effects) {
    /*    触发的依赖函数不等于当前执正在行的副作用函数 防止死循环 */
    if (reactiveEffect !== activeEffect) {
      if (reactiveEffect.scheduler) {
        reactiveEffect.scheduler()
      } else {
        reactiveEffect.run()
      }
    }
  }
}
// 用于将传入的 ReactiveEffect 类的实例从与该实例相关的响应式对象的 property 对应的 Set 实例中删除
function cleanupEffect(effect: ReactiveEffect) {
  // 获取与该effect有关的被观察者的effect集合
  // 从前面可知，该effect关联的监控对象指向的dep是在同一个存储地址
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      //deps[i].delete操作切除了被观察与effect的联系，deps.length=0，操作切除了effect与被观察的联系。
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}
// 用于停止传入的函数的执行
export function stop(runner) {
  // 调用 runner 的 effect property 的 stop 方法
  runner.effect.stop()
}
