# 🚀 Welcome to 响应系统的源码简版 -ZSM reactivity# 1.项目结构介绍

```javascript
1.选用TS+jest（测试框架）
2.测试用例驱动功能代码实现
```

```javascript
前置知识点 ts （接口 类型 枚举 泛型  谓词签名（is） 断◊言签名（as）等）

vue核心三件 - 响应系统  渲染 编译

关于WeakMap以及js位运算

```

# 2.实现 reactivity

## 实现最基础的`reactive`

查看 [Vue3 API 文档中的响应性 API 部分](https://link.juejin.cn/?target=https%3A%2F%2Fv3.cn.vuejs.org%2Fapi%2Fbasic-reactivity.html%23reactive)，找到`reactive`的介绍

 reactive返回对象的响应式副本

```typescript
const obj = reactive({ count: 0 })
```

响应式转换是“深层”的——它影响所有嵌套 property。在基于 ES2015 Proxy 的实现中，返回的 proxy 是不等于原始对象的。建议只使用响应式 proxy，避免依赖原始对象。

类型声明

```typescript
function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
```

在实现`reactive`之前，首先在`src/reactivity/__tests__`目录下创建`reactive`的测试文件`reactive.spec.ts`，并添加以下测试代码：

```typescript
describe('reactivity/reactive', () => {
  it('Object', () => {
    const original = { foo: 1 }
    // reactive 返回对象的响应式副本
    const observed = reactive(original)
    // observed !== original
    expect(observed).not.toBe(original)
    // observed 的 property 的值与 original 的相等
    expect(observed.foo).toBe(1)
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下创建`reactive.ts`文件，在其中实现并导出`reactive`：

```typescript
export function reactive(raw) {
  // 返回 Proxy 的实例
  return new Proxy(raw, {
    // 对原始对象的 property 的 get 和 set 进行代理
    get(target, key) {
      // TODO: 收集依赖
      return Reflect.get(target, key)
    },
    set(target, key, value) {
      // TODO: 触发依赖
      return Reflect.set(target, key, value)
    }
  })
}
```

## 实现最基础的`effect`

`effect`接受一个函数作为参数，在程序运行时会执行该函数。若该函数中使用了响应式对象的 property，当该 property 的值更新时，会再次执行该函数

在实现`effect`之前，首先在`src/reactivity/__tests__`目录下创建`effect`的测试文件`effect.spec.ts`，并添加以下测试代码：

```typescript
describe('effect', () => {
  it('should run the passed function once (wrapped by a effect)', () => {
    // 创建 mock 函数
    const fnSpy = jest.fn(() => {})
    effect(fnSpy)
    // 当程序执行时，传入的函数会被执行
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  it('should observe basic properties', () => {
    let dummy
    // 创建响应式对象
    const counter = reactive({ num: 0 })
    // 在传入的函数中使用了响应式对象的 property
    effect(() => (dummy = counter.num))

    expect(dummy).toBe(0)
    // 当该 property 的值更新时，会再次执行该函数
    counter.num = 7
    expect(dummy).toBe(7)
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下创建`effect.ts`文件，在其中实现一个不完全的`effect`并导出，在实现过程中抽离出一个`ReactiveEffect`类，对相关操作进行封装：

```typescript
// 抽离出一个 ReactiveEffect 类，对相关操作进行封装
class ReactiveEffect {
  private _fn: any

  constructor(fn) {
    // 将传入的函数赋值给实例的私有 property _fn
    this._fn = fn
  }

  // 执行传入的函数
  run() {
    this._fn()
  }
}

// 接受一个函数作为参数
export function effect(fn) {
  // 利用传入的函数创建 ReactiveEffect 类的实例
  const _effect: ReactiveEffect = new ReactiveEffect(fn)

  // 调用 ReactiveEffect 实例的 run 方法，执行传入的函数
  _effect.run()
}
```

这样就实现了一个不完全的`effect`，即能够在程序运行时执行传入的函数。之后，在`reactive`返回的 Proxy 的实例的 get 中收集依赖，在 set 中触发依赖

```typescript
export function reactive(raw) {
  // 返回 Proxy 的实例
  return new Proxy(raw, {
    // 对原始对象的 get 进行代理
    get(target, key) {
      const res = Reflect.get(target, key)
      // 收集依赖
      track(target, key)
      return res
    },
    // 对原始对象的 set 进行代理
    set(target, key, value) {
      const res = Reflect.set(target, key, value)
      // 触发依赖
      trigger(target, key)
      return res
    }
  })
}
```

在`effect.ts`文件中实现并导出`track`和`trigger`函数，在实现过程中使用了一个全局的`WeakMap`类型的变量`targetsMap`，用于保存程序运行中的所有依赖，以及一个全局的变量`activeEffect`，用于保存正在执行的`ReactiveEffect`类的实例

```typescript
class ReactiveEffect {
  /* 其他代码 */

  run() {
    // 调用 run 方法时，用全局变量 activeEffect 保存当前实例
    activeEffect = this
    this._fn()
  }
}

/**
 * 用于保存程序运行中的所有依赖
 * key 为响应式对象
 * value 为 Map 的实例，用于保存该响应式对象的所有依赖
 */
const targetsMap = new WeakMap()

// 用于保存正在执行的 ReactiveEffect 类的实例
let activeEffect: ReactiveEffect

// 用于收集依赖
export function track(target, key) {
  // 获取当前响应式对象对应的 Map 实例,若为 undefined 则进行初始化并保存到 targetsMap 中
  /**
   * 用于保存当前响应式对象的所有依赖
   * key 为响应式对象的 property
   * value 为 Set 的实例，用于保存与该 property 相关的 ReactiveEffect 类的实例
   */
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

  // 若 dep 中包括当前正在执行的 ReactiveEffect 类的实例则直接返回
  if (dep.has(activeEffect!)) {
    return
  }

  // 将当前正在执行的 ReactiveEffect 类的实例添加到 dep 中
  dep.add(activeEffect)
}

// 用于触发依赖
export function trigger(target, key) {
  // 获取当前响应式对象对应的 Map 实例
  const depsMap: Map<any, Set<ReactiveEffect>> = targetsMap.get(target)
  // 获取当前 property 对应的 Set 实例
  const dep: Set<ReactiveEffect> = depsMap.get(key)!

  // 遍历 dep，调用每一个 ReactiveEffect 类的实例的 run 方法
  for (const reactiveEffect of dep) {
    reactiveEffect.run()
  }
}

```

## 完善`effect`——返回`runner`

`effect`执行会返回一个函数，用一个变量`runner`接受该函数，调用`runner`时会再次执行传入的函数，同时返回该函数的返回值。

在`effect`的测试文件`effect.spec.ts`中添加以下测试代码：

```typescript
describe('effect', () => {
  /* 其他测试代码 */

  it('should return a function to be called manually', () => {
    let foo = 0
    // 用一个变量 runner 接受 effect 执行返回的函数
    const runner = effect(() => {
      foo++
      return 'foo'
    })
    expect(foo).toBe(1)
    // 调用 runner 时会再次执行传入的函数
    const res = runner()
    expect(foo).toBe(2)
    // runner 执行返回该函数的返回值
    expect(res).toBe('foo')
  })
})
```

为了通过以上测试，需要对`effect`的实现进行完善。首先，`effect`执行返回`_effect.run`，并将其`this`指向指定为`_effect`，其次`run`方法执行返回传入的函数执行的结果：

```typescript
class ReactiveEffect {
  /* 其他代码 */

  run() {
    activeEffect = this

    // 返回传入的函数执行的结果
    return this._fn()
  }
}

export function effect(fn) {
  const _effect: ReactiveEffect = new ReactiveEffect(fn)

  _effect.run()

  // 返回 _effect.run，并将其 this 指向指定为 _effect
  return _effect.run.bind(_effect)
}
```

## 完善`effect`——接受`scheduler`

`effect`接受一个对象作为第二个参数，该对象中可以包括一个`scheduler`方法。用一个变量`runner`接受`effect`执行返回的函数，程序运行时会首先执行传入的函数，而不会调用`scheduler`方法，之后当传入的函数依赖的响应式对象的 property 的值更新时，会调用`scheduler`方法而不会执行该函数，只有当调用`runner`时才会执行该函数。

在`effect`的测试文件`effect.spec.ts`中添加以下测试代码：

```typescript
describe('effect', () => {
  /* 其他测试代码 */

  it('scheduler', () => {
    let dummy
    let run: number
    // 创建 mock 函数
    const scheduler = jest.fn(() => {
      run++
    })
    const obj = reactive({ foo: 1 })
    const runner = effect(
      () => {
        dummy = obj.foo
      },
      { scheduler }
    )
    // 程序运行时会首先执行传入的函数，而不会调用 scheduler 方法
    expect(scheduler).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
    // 当传入的函数依赖的响应式对象的 property 的值更新时，会调用 scheduler 方法而不会执行传入的函数
    obj.foo++
    expect(scheduler).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)
    // 只有当调用 runner 时才会执行传入的函数
    runner()
    expect(scheduler).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(2)
  })
})
```

为了通过以上测试，需要对`effect`的实现和`trigger`函数进行完善。

```typescript
class ReactiveEffect {
  /* 其他代码 */

  // 构造函数接受可选的第二个参数，保存为实例的公共变量 scheduler
  constructor(fn, public scheduler?) {
    this._fn = fn
  }
}

// 接受一个函数作为第一个参数，接受一个对象作为第二个参数
export function effect(fn, options: any = {}) {
  // 利用传入的函数创建 ReactiveEffect 类的实例，并将 scheduler 方法传给 ReactiveEffect 类的构造函数
  const _effect: ReactiveEffect = new ReactiveEffect(fn, options.scheduler)

  /* 其他代码 */
}

export function trigger(target, key) {
  /* 其他代码 */

  /**
   * 遍历 dep，判断每一个 ReactiveEffect 类的实例的 scheduler property 是否存在
   * 若不为 undefined 则调用 scheduler 方法，否则调用 run 方法
   */
  for (const reactiveEffect of dep) {
    if (reactiveEffect.scheduler) {
      reactiveEffect.scheduler()
    } else {
      reactiveEffect.run()
    }
  }
}
```

## 完善`effect`——`stop`

`stop`接受`effect`执行返回的函数作为参数。用一个变量`runner`接受`effect`执行返回的函数，调用`stop`并传入`runner`后，当传入的函数依赖的响应式对象的 property 的值更新时不会再执行该函数，只有当调用`runner`时才会恢复执行该函数。

在`effect`的测试文件`effect.spec.ts`中添加以下测试代码：

```typescript
describe('effect', () => {
  /* 其他测试代码 */

it('stop', () => {
        let dummy;
        const obj = reactive({ prop: 1 });
        const runner = effect(() => {
            dummy = obj.prop;
        });
        obj.prop = 2;
        expect(dummy).toBe(2);
        // 调用 stop 后，当传入的函数依赖的响应式对象的 property 的值更新时不会再执行该函数
        stop(runner);
        obj.prop = 3;
        expect(dummy).toBe(2);
        obj.prop++;
        expect(dummy).toBe(4);
        // 只有当调用`runner`时才会恢复执行该函数
        runner();
        expect(dummy).toBe(4);
    });
})
```

为了通过以上测试，需要对`effect`的实现进行完善，实现并导出`stop`：

```typescript
// 用于记录是否应该收集依赖，防止调用 stop 后触发响应式对象的 property 的 get 时收集依赖
let shouldTrack: boolean = false

class ReactiveEffect {
  /* 其他代码 */

  // 用于保存与当前实例相关的响应式对象的 property 对应的 Set 实例
  deps: Array<Set<ReactiveEffect>> = []
  // 用于记录当前实例状态，为 true 时未调用 stop 方法，否则已调用，防止重复调用 stop 方法
  active: boolean = true

  // 用于执行传入的函数
  run() {
    // 若已调用 stop 方法则直接返回传入的函数执行的结果
    if (!this.active) {
      return this._fn()
    }

    // 应该收集依赖
    shouldTrack = true
    // 调用 run 方法时，用全局变量 activeEffect 保存当前实例
    activeEffect = this

    const res = this._fn()
    // 重置
    shouldTrack = false

    // 返回传入的函数执行的结果
    return res
  }

  // 用于停止传入的函数的执行
  stop() {
    if (this.active) {
      cleanupEffect(this)
      this.active = false
    }
  }
}

// 用于将传入的 ReactiveEffect 类的实例从与该实例相关的响应式对象的 property 对应的 Set 实例中删除
function cleanupEffect(effect: ReactiveEffect) {
  effect.deps.forEach((dep: any) => {
    dep.delete(effect)
  })
}

export function effect(fn, options: any = {}) {
  /* 其他代码 */

  // 用一个变量 runner 保存将 _effect.run 的 this 指向指定为 _effect 的结果
  const runner: any = _effect.run.bind(_effect)
  // 将 _effect 赋值给 runner 的 effect property
  runner.effect = _effect

  // 返回 runner
  return runner
}

export function track(target, key) {
  // 若不应该收集依赖则直接返回
  if (!shouldTrack || activeEffect === undefined) {
    return
  }

  /* 其他代码 */

  dep.add(activeEffect!)
  // 将 dep 添加到当前正在执行的 ReactiveEffect 类的实例的 deps property 中
  activeEffect?.deps.push(dep)
}

// 用于停止传入的函数的执行
export function stop(runner) {
  // 调用 runner 的 effect property 的 stop 方法
  runner.effect.stop()
}
```

## 完善`effect`——接受`onStop`

`effect`接受一个对象作为第二个参数，该对象中还可以包括一个`onStop`方法。用一个变量`runner`接受`effect`执行返回的函数，调用`stop`并传入`runner`时，会执行`onStop`方法。

在`effect`的测试文件`effect.spec.ts`中添加以下测试代码

```typescript
describe('effect', () => {
  /* 其他测试代码 */

  it('events: onStop', () => {
    // 创建 mock 函数
    const onStop = jest.fn()
    const runner = effect(() => {}, {
      onStop
    })

    // 调用 stop 时，会执行 onStop 方法
    stop(runner)
    expect(onStop).toHaveBeenCalled()
  })
})
```

为了通过以上测试，需要对`effect`的实现进行完善。

```typescript
class ReactiveEffect {
  /* 其他代码 */

  // 用于保存当前实例的 onStop 方法
  onStop?: () => void

  stop() {
    if (this.active) {
      cleanupEffect(this)
      // 在调用 stop 方法时，调用 onStop 方法
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

export function effect(fn, options: any = {}) {
  const _effect: ReactiveEffect = new ReactiveEffect(fn, options.scheduler)
  // 将 onStop 方法挂载到 ReactiveEffect 类的实例上
  _effect.onStop = options.onStop

  /* 其他代码 */
}
```

`effect`接受一个对象作为第二个参数，该对象中可以包括多个属性和方法，在`effect`的实现中若依次挂载到`ReactiveEffect`类的实例上将会十分繁琐，因此可以使用`Object.assign`方法，同时为了提高代码的可读性，可以为其设置别名。在`src/shared`目录下创建`index.ts`文件，并添加以下代码：

```typescript
// 为 Object.assign 方法创建别名
export const extend = Object.assign
```

利用`Object.assign`方法对之前的实现做简单优化：

增加lazy懒属性不立即调用副作用函数：

```typescript
export function effect(fn, options: any = {}) {
  const _effect: ReactiveEffect = new ReactiveEffect(fn)
  // 将第二个参数即 options 对象的属性和方法挂载到 ReactiveEffect 类的实例上
  extend(_effect, options)
 if (!options || !options.lazy) {
        _effect.run();
    }
  /* 其他代码 */
}
```

## 实现最基础的`readonly`

查看 [Vue3 API 文档中的响应性 API 部分](https://link.juejin.cn/?target=https%3A%2F%2Fv3.cn.vuejs.org%2Fapi%2Fbasic-reactivity.html%23readonly)，找到`readonly`的介绍：

接受一个对象（响应式或纯对象）或 ref 并返回原始对象的只读代理。只读代理是深层的：任何被访问的嵌套 property 也是只读的。

```typescript
onst original = reactive({ count: 0 })

const copy = readonly(original)

watchEffect(() => {
  // 用于响应性追踪
  console.log(copy.count)
})

// 变更 original 会触发依赖于副本的侦听器
original.count++

// 变更副本将失败并导致警告
copy.count++ // 警告!
```

在实现`readonly`之前，首先在`src/reactivity/__tests__`目录下创建`readonly`的测试文件`readonly.spec.ts`，并添加以下测试代码：

```typescript
describe('reactivity/readonly', () => {
  it('should make values readonly', () => {
    const original = { foo: 1 }
    // 创建 readonly 响应式对象
    const wrapped = readonly(original)
    console.warn = jest.fn()
    // readonly 响应式对象与原始对象不相等
    expect(wrapped).not.toBe(original)
    expect(wrapped.foo).toBe(1)
    // readonly 响应式对象的 property 是只读的
    wrapped.foo = 2
    expect(wrapped.foo).toBe(1)
    // 修改 readonly 响应式对象的 property 的值时会调用 console.warn 发出警告
    expect(console.warn).toBeCalled()
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下的`reactive.ts`文件中实现并导出`readonly`：

```typescript
export function readonly(raw) {
  // 返回 Proxy 的实例
  return new Proxy(raw, {
    // 对原始对象的 get 进行代理
    get(target, key) {
      const res = Reflect.get(target, key)

      return res
    },
    // 对原始对象的 set 进行代理
    set() {
      // TODO: 警告!
      return true
    }
  })
}
```

`reactive`和`readonly`的实现中有较多重复，需要对其中的代码进行优化，抽离重复代码，提高可读性。在`src/reactivity/src`目录下创建`baseHandlers.ts`文件，将与创建用于构造 Proxy 的 handlers 相关的代码抽离到其中，并抽离出工具函数和使用全局变量进行缓存：

```typescript
// 对 get 和 set 进行缓存，防止重复调用工具函数
const get = createGetter()
const set = createSetter()
const readonlyGet = createGetter(true)

// 用于生成 get 函数的工具函数
function createGetter(isReadonly = false) {
  return function (target, key) {
    const res = Reflect.get(target, key)

    // 利用 reactive 进行响应式转换时才进行依赖收集
    if (!isReadonly) {
      // 收集依赖
      track(target, key)
    }

    return res
  }
}

// 用于生成 set 函数的工具函数
function createSetter() {
  return function (target, key, value) {
    const res = Reflect.set(target, key, value)
    // 触发依赖
    trigger(target, key)
    return res
  }
}

// reactive 对应的 handlers
export const mutableHandlers = {
  get,
  set
}

// readonly 对应的 handlers
export const readonlyHandlers = {
  get: readonlyGet,
  set(target, key) {
    // 调用 console.warn 发出警告
    console.warn(
      `Set operation on key "${key}" failed: target is readonly.`,
      target
    )
    return true
}

// reactive.ts 之后对reactive和readonly的实现进行优化，抽离出工具函数：
export function reactive(raw) {
  return createReactiveObject(raw, mutableHandlers)
}

export function readonly(raw) {
  return createReactiveObject(raw, readonlyHandlers)
}

// 用于创建 Proxy 实例的工具函数
function createReactiveObject(raw, baseHandlers) {
  // 返回 Proxy 的实例
  return new Proxy(raw, baseHandlers)
}
```

##  实现`isReactive`、`isReadonly`和`isProxy`

查看 [Vue3 API 文档中的响应性 API 部分](https://link.juejin.cn/?target=https%3A%2F%2Fv3.cn.vuejs.org%2Fapi%2Fbasic-reactivity.html)，找到`isProxy`、`isReactive`和`isReadonly`的介绍：

isProxy检查对象是否是由`reactive`或`readonly`创建的 proxy。

isReactive检查对象是否是由`reactive`创建的响应式代理。

```typescript
mport { reactive, isReactive } from 'vue'
export default {
  setup() {
    const state = reactive({
      name: 'John'
    })
    console.log(isReactive(state)) // -> true
  }
}

```

如果该代理是`readonly`创建的，但包裹了由`reactive`创建的另一个代理，它也会返回`true`。

```typescript
import { reactive, isReactive, readonly } from 'vue'
export default {
  setup() {
    const state = reactive({
      name: 'John'
    })
    // 从普通对象创建的只读 proxy
    const plain = readonly({
      name: 'Mary'
    })
    console.log(isReactive(plain)) // -> false

    // 从响应式 proxy 创建的只读 proxy
    const stateCopy = readonly(state)
    console.log(isReactive(stateCopy)) // -> true
  }
}
```

isReadonly检查对象是否是由`readonly`创建的只读代理。

### ① 实现`isReactive`

在实现`isReactive`之前，首先在`reactive`的测试文件`reactive.spec.ts`中增加关于`isReactive`的测试代码

```typescript
describe('reactivity/reactive', () => {
  it('Object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(observed).not.toBe(original)
    // 对响应式对象调用 isReactive 返回 true
    expect(isReactive(observed)).toBe(true)
    // 对普通对象调用 isReactive 返回 false
    expect(isReactive(original)).toBe(false)
    expect(observed.foo).toBe(1)
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下的`reactive.ts`文件中实现并导出`isReactive`：

```typescript
// 用于检查对象是否是由 reactive 创建的响应式对象
export function isReactive(value): boolean {
  // 获取对象的某个特殊 property 的值，从而触发 get，property 名为 __v_isReactive
  return !!value['__v_isReactive']
}
```

同时，还需要对`src/reactivity/src`目录下的`baseHandlers.ts`文件中的`createGetter`工具函数做相应修改：

```typescript
function createGetter(isReadonly = false) {
  return function (target, key) {
    // 当 property 名为 __v_isReactive 时，表明正在调用 isReactive，直接返回 !isReadonly
    if (key === '__v_isReactive') {
      return !isReadonly
    }

    /* 其他代码 */
  }
}
```

### ② 实现`isReadonly`

在实现`isReadonly`之前，首先在`readonly`的测试文件`readonly.spec.ts`中增加关于`isReadonly`的测试代码

```typescript
describe('reactivity/readonly', () => {
  it('should make values readonly', () => {
    const original = { foo: 1 }
    const wrapped = readonly(original)
    console.warn = jest.fn()
    expect(wrapped).not.toBe(original)
    // 对 readonly 响应式对象调用 isReactive 返回 false
    expect(isReactive(wrapped)).toBe(false)
    // 对 readonly 响应式对象调用 isReadonly 返回 true
    expect(isReadonly(wrapped)).toBe(true)
    // 对普通对象调用 isReactive 返回 false
    expect(isReactive(original)).toBe(false)
    // 对普通对象调用 isReadonly 返回 false
    expect(isReadonly(original)).toBe(false)
    expect(wrapped.foo).toBe(1)
    wrapped.foo = 2
    expect(wrapped.foo).toBe(1)
    expect(console.warn).toBeCalled()
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下的`reactive.ts`文件中实现并导出`isReadonly`：

```typescript
// 用于检查对象是否是由 readonly 创建的 readonly 响应式对象
export function isReadonly(value): boolean {
  // 获取对象的某个特殊 property 的值，从而触发 get，property 名为 __v_isReactive
  return !!value['__v_isReadonly']
}
```

同时，还需要对`src/reactivity/src`目录下的`baseHandlers.ts`文件中的`createGetter`工具函数做相应修改：

```typescript
function createGetter(isReadonly = false) {
  return function (target, key) {
    // 当 property 名为 __v_isReactive 时，表明正在调用 isReactive，直接返回 !isReadonly
    if (key === '__v_isReactive') {
      return !isReadonly
    }
    // 当 property 名为 __v_isReadonly 时，表明正在调用 isReadonly，直接返回 isReadonly
    else if (key === '__v_isReadonly') {
      return isReadonly
    }

    /* 其他代码 */
  }
}
```

### ③ 实现`isProxy`

在实现`isProxy`之前，首先分别在`reactive`的测试文件`reactive.spec.ts`和`readonly`的测试文件`readonly.spec.ts`中增加关于`isProxy`的测试代码：

```typescript
// reactive.spec.ts
describe('reactivity/reactive', () => {
  it('Object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(observed).not.toBe(original)
    expect(isReactive(observed)).toBe(true)
    expect(isReactive(original)).toBe(false)
    // 对响应式对象调用 isProxy 返回 true
    expect(isProxy(observed)).toBe(true)
    // 对普通对象调用 isProxy 返回 false
    expect(isProxy(original)).toBe(false)
    expect(observed.foo).toBe(1)
  })
})
```

```typescript
// readonly.spec.ts
describe('reactivity/readonly', () => {
  it('should make values readonly', () => {
    const original = { foo: 1 }
    const wrapped = readonly(original)
    console.warn = jest.fn()
    expect(wrapped).not.toBe(original)
    expect(isReactive(wrapped)).toBe(false)
    expect(isReadonly(wrapped)).toBe(true)
    expect(isReactive(original)).toBe(false)
    expect(isReadonly(original)).toBe(false)
    // 对 readonly 响应式对象调用 isProxy 返回 true
    expect(isProxy(wrapped)).toBe(true)
    // 对普通对象调用 isProxy 返回 false
    expect(isProxy(original)).toBe(false)
    expect(wrapped.foo).toBe(1)
    wrapped.foo = 2
    expect(wrapped.foo).toBe(1)
    expect(console.warn).toBeCalled()
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下的`reactive.ts`文件中实现并导出`isProxy`：

```typescript
// 用于检查对象是否是由 reactive 或 readonly 创建的响应式对象
export function isProxy(value): boolean {
  // 利用 isReactive 和 isReadonly 进行判断
  return isReactive(value) || isReadonly(value)
}
```

### ④ 优化代码

`isReactive`和`isReadonly`的实现中使用到的特殊 property 的名为字符串，需要对其进行优化，创建并导出枚举类型`ReactiveFlags`用于保存这两个字符串：

```typescript
//reactive.ts
// 用于保存 isReactive 和 isReadonly 中使用的特殊 property 的名
export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly'
}
// baseHandlers.ts
function createGetter(isReadonly = false) {
  return function (target, key) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    }

    /* 其他代码 */
  }
}
```

```typescript
// reactive.ts
export function isReactive(value): boolean {
  return !!value[ReactiveFlags.IS_REACTIVE]
}

export function isReadonly(value): boolean {
  return !!value[ReactiveFlags.IS_READONLY]
}
```

## 完善`reactive`和`readonly`——响应式转换嵌套对象

`reactive`和`readonly`的响应式转换是“深层”的，会影响所有嵌套的 property，即嵌套的 property 也应该是响应式的。

分别在`reactive`的测试文件`reactive.spec.ts`和`readonly`的测试文件`readonly.spec.ts`中添加以下测试代码：

```typescript
// reactive.spec.ts
describe('reactivity/reactive', () => {
  it('nested reactives', () => {
    const original = { foo: { bar: 1 } }
    const observed = reactive(original)
    // 嵌套对象是响应式的
    expect(isReactive(observed.foo)).toBe(true)
  })
})
```

```typescript
// readonly.spec.ts
describe('reactivity/readonly', () => {
  it('should make nested values readonly', () => {
    const original = { foo: { bar: 1 } }
    const wrapped = readonly(original)
    // 嵌套对象是响应式的
    expect(isReadonly(wrapped.foo)).toBe(true)
  })
})
```

为了通过以上测试，需要对`reactive`和`readonly`的实现进行完善，对`src/reactivity/src`目录下的`baseHandlers.ts`文件中的`createGetter`工具函数做如下修改

```typescript
function createGetter(isReadonly = false) {
  return function (target, key) {
    /* 其他代码 */

    const res = Reflect.get(target, key)

    if (!isReadonly) {
      track(target, key)
    }

    // 若 property 的值为对象，则利用 reactive 和 readonly 进行响应式转换
    if (typeof res === 'object' && res !== null) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}
```

由于可能会多次使用到，因此可以将判断一个变量是否为对象抽离成一个`isObject`函数。在`src/shared`目录下的`index.ts`文件中添加以下代码：

```typescript
// 用于判断一个变量是否为对象
export const isObject = value => typeof value === 'object' && value !== null
```

之后利用`isObject`函数完善`createGetter`工具函数：

```typescript
function createGetter(isReadonly = false) {
  return function (target, key) {
    /* 其他代码 */

    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    /* 其他代码 */
  }
}
```

## 实现`shallowReactive`和`shallowReadonly`

查看 [Vue3 API 文档中的响应性 API 部分](https://link.juejin.cn/?target=https%3A%2F%2Fv3.cn.vuejs.org%2Fapi%2Fbasic-reactivity.html)，找到`shallowReactive`和`shallowReadonly`的介绍：

shallowReactive创建一个响应式代理，它跟踪其自身 property 的响应性，但不执行嵌套对象的深层响应式转换（暴露原始值）

```typescript
const state = shallowReactive({
  foo: 1,
  nested: {
    bar: 2
  }
})

// 改变 state 本身的性质是响应式的
state.foo++
// ...但是不转换嵌套对象
isReactive(state.nested) // false
state.nested.bar++ // 非响应式
```

与`reactive`不同，任何使用`ref`的 property 都不会被代理自动解包。

shallowReadonly 创建一个 proxy，使其自身的 property 为只读，但不执行嵌套对象的深度只读转换（暴露原始值）。

```typescript
const state = shallowReadonly({
  foo: 1,
  nested: {
    bar: 2
  }
})

// 改变 state 本身的 property 将失败
state.foo++
// ...但适用于嵌套对象
isReadonly(state.nested) // false
state.nested.bar++ // 适用
```

与`readonly`不同，任何使用`ref`的 property 都不会被代理自动解包

在实现`shallowReactive`和`shallowReadonly`之前，首先在`src/reactivity/__tests__`目录下分别创建`shallowReactive`和`shallowReadonly`的测试文件`shallowReactive.spec.ts`和`shallowReadonly.spec.ts`，分别添加以下测试代码：

```typescript
// shallowReactive.spec.ts
describe('shallowReactive', () => {
  test('should not make non-reactive properties reactive', () => {
    const props = shallowReactive({ n: { foo: 1 } })
    expect(isReactive(props.n)).toBe(false)
  })
})
```

```typescript
// shallowReadonly.spec.ts
describe('reactivity/shallowReadonly', () => {
  test('should not make non-reactive properties reactive', () => {
    const props = shallowReadonly({ n: { foo: 1 } })
    expect(isReactive(props.n)).toBe(false)
  })
})
```

为了通过以上测试，同时根据之前优化代码的思路，首先对`src/reactivity/src`目录下的`baseHandlers.ts`文件中的`createGetter`工具函数做如下修改：

```typescript
function createGetter(isReadonly = false, shallow = false) {
  return function (target, key) {
    /* 其他代码 */

    const res = Reflect.get(target, key)

    // 利用 reactive 和 shallowReactive 进行响应式转换时才进行依赖收集
    if (!isReadonly) {
      // 收集依赖
      track(target, key)
    }

    // 若利用 shallowReactive 和 shallowReadonly 进行响应式转换则直接返回
    if (shallow) {
      return res
    }

    /* 其他代码 */
  }
}
```

之后，在`src/reactivity/src`目录下的`baseHandlers.ts`文件中分别构建`shallowRreactive`和`shallowReadonly`对应的 handlers，二者分别是由`mutableHandlers`和`readonlyHandlers`替换 get property 得到的：

```typescript
// shallowRreactive 对应的 handlers 是由 mutableHandlers 替换 get property 得到的
export const shallowHandlers = extend({}, mutableHandlers, {
  get: shallowGet
})

// shallowReadonly 对应的 handlers 是由 readonlyHandlers 替换 get property 得到的
export const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
  get: shallowReadonlyGet
})
```

最后，在`src/reactivity/src`目录下的`reactive.ts`文件中实现并导出`shallowRreactive`和`shallowReadonly`：

```typescript
export function shallowReactive(raw) {
  return createReactiveObject(raw, shallowHandlers)
}

export function shallowReadonly(raw) {
  return createReactiveObject(raw, shallowReadonlyHandlers)
}
```

### 处理几个effect的特例（暂不涉及数组）

### 1.target对应已注册的proxy无需重新注册

```typescript
// 例子
let test={num:1}
let a1=reactive(test)
let a2=reactive(test)

```

```typescript
export const reactiveMap = new WeakMap<Target, any>();
export const readonlyMap = new WeakMap<Target, any>();
export const shallowReactiveMap = new WeakMap<Target, any>();
export const shallowReadonlyMap = new WeakMap<Target, any>();
export function reactive(target) {
    // 如果目标对象是一个只读的响应数据,则直接返回目标对象
    if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
        return target;
    }
    return createReactiveObject(target, false, mutableHandlers, reactiveMap);
}
export function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyMap);
}
export function shallowReactive(target) {
    return createReactiveObject(target, false, shallowHandlers, shallowReactiveMap);
}
export function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyMap);
}
// 用于创建 Proxy 实例的工具函数
function createReactiveObject(
    target: Target,
    isReadonly: boolean,
    baseHandlers: ProxyHandler<any>,
    proxyMap: WeakMap<Target, any>
) {
    if (!isObject(target)) {
        // 不是对象直接返回
        return target;
    }
    // 查看当前代理对象之前是不是创建过当前代理，如果创建过直接返回之前缓存的代理对象
    // proxyMap 是一个全局的缓存WeakMap
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    // 返回 Proxy 的实例
    const proxy = new Proxy(target, baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}
```

## 2.如果传入的已经是代理了 并且 不是readonly 转换 reactive的直接返回实现

```typescript
// 例子
let test=reactive(readonly({num:1})) // =====> readonly({num:1})
let test01=readonly(reactive({num:1})) //readonly( reaceive({num1}))
```

```typescript
 // 函数 createReactiveObject里
// 如果传入的已经是代理了 并且 不是readonly 转换 reactive的直接返回
    if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
        return target;
    }
//新增枚举
export const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive',
    IS_READONLY = '__v_isReadonly',
    RAW = '__v_raw'
}
export interface Target {
    [ReactiveFlags.IS_REACTIVE]?: boolean; // target 是否是响应式
    [ReactiveFlags.IS_READONLY]?: boolean; // target 是否是只读
    [ReactiveFlags.RAW]?: any; // 表示 proxy 对应的源数据，target 已经是 proxy 对象时会有该属性
}
```

```typescript
// baseHandles.ts 
// 用于生成 get 函数的工具函数
function createGetter(isReadonly = false, shallow = false) {
    return function (target, key, receiver) {
        //  ReactiveFlags 是在reactive中声明的枚举值，如果key是枚举值则直接返回对应的布尔值
        if (key === ReactiveFlags.IS_REACTIVE) {
            return !isReadonly;
        } else if (key === ReactiveFlags.IS_READONLY) {
            return isReadonly;
        } else if (
            // 如果key是raw  receiver 指向调用者，则直接返回目标对象。
            // 这里判断是为了保证触发拦截 handle 的是 proxy 本身而不是 proxy 的继承者
            // 触发拦的两种方式：一是访问 proxy 对象本身的属性，二是访问对象原型链上有 proxy 对象的对象的属性，因为查询会沿着原型链向下找
            key === ReactiveFlags.RAW &&
            receiver ===
                (isReadonly
                    ? shallow
                        ? shallowReadonlyMap
                        : readonlyMap
                    : shallow
                    ? shallowReactiveMap
                    : reactiveMap
                ).get(target)
        ) {
            return target;
        }
        const res = Reflect.get(target, key, receiver);
        // 利用 reactive 进行响应式转换时才进行依赖收集
        if (!isReadonly) {
            // 收集依赖
            track(target, key);
        }
        if (shallow) {
            return res;
        }
        // 由于 proxy 只能代理一层，如果子元素是对象，需要递归继续代理
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
```

### 3.嵌套effect,外层副作用函数失效

### 4.同时收集触发依赖造成死循环

### 5.增加deferStop 防止内部停止不了当前副作用

```typescript
// 例子 嵌套effect
let test=reactive({num:1})
let test2=reactive({num2:1})
effect(()=>{
  effect(()=>{
    console.log(test2.num2)
  })
  console.log(test.num)
})
//  收集触发依赖死循环
effect(()=>{
  test.num++
})
// 内部停止不了当前副作用
let runner=effect(()=>{
  if(test.num>3){
    stop(runner)
  }
})
```

```
// 抽离出一个 ReactiveEffect 类，对相关操作进行封装
export class ReactiveEffect {
    private _fn: any;
    // 用于保存与当前实例相关的响应式对象的 property 对应的 Set 实例
    deps: Array<Set<ReactiveEffect>> = [];
    // 用于记录当前实例状态，为 true 时未调用 stop 方法，否则已调用，防止重复调用 stop 方法
    active: boolean = true;
    parent: ReactiveEffect | undefined = undefined;
    // 防止内部调用 无法stop该副作用
    private deferStop?: boolean;
    constructor(fn, public scheduler?) {
        // 将传入的函数赋值给实例的私有 property _fn
        this._fn = fn;
    }
    // 执行传入的函数
    run() {
        // 若已调用 stop 方法则直接返回传入的函数执行的结果
        if (!this.active) {
            return this._fn();
        }
        let parent: ReactiveEffect | undefined = activeEffect;
        // 防止内嵌产生导致外层依赖无法收集
        let lastShouldTrack = shouldTrack;
        while (parent) {
            // 处理副作用函数get 和 set同时操作造成内存溢出
            if (parent === this) {
                return;
            }
            parent = parent.parent;
        }
        // debugger;
        try {
            this.parent = activeEffect;
            // 应该收集依赖
            shouldTrack = true;
            // 调用 run 方法时，用全局变量 activeEffect 保存当前实例
            activeEffect = this as any;
            // 执行前清除依赖
            cleanupEffect(this);
            //执行副作用函数 触发收集依赖
            const res = this._fn();
            // 返回传入的函数执行的结果
            return res;
        } finally {
            // 储存上一个副作用函数的实例
            activeEffect = this.parent;
            // 重置
            shouldTrack = lastShouldTrack;

            this.parent = undefined;
            // 清除依赖
            if (this.deferStop) {
                this.stop();
            }
        }
    }
    onStop?: () => void;
    // 用于停止传入的函数的执行
    stop() {
        // 防止内部调用 最后副作用函数完成时依赖未完全清除时 导致清除无效
        if (activeEffect == this) {
            this.deferStop = true;
        } else if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
```



## `ref`

查看 [Vue3 API 文档中的响应性 API 部分](https://link.juejin.cn/?target=https%3A%2F%2Fv3.cn.vuejs.org%2Fapi%2Frefs-api.html%23ref)，找到`ref`的介绍。

ref 接受一个内部值并返回一个响应式且可变的 ref 对象。ref 对象具有指向内部值的单个 property .value。

示例：

```typescript
const count = ref(0)
console.log(count.value) // 0

count.value++
console.log(count.value) // 1
```

如果将对象分配为 ref 值，则通过`reactive`函数使该对象具有高度的响应式。

类型声明：

```typescript
interface Ref<T> {
  value: T
}

function ref<T>(value: T): Ref<T>
```

有时我们可能需要为 ref 的内部值指定复杂类型。想要简洁地做到这一点，我们可以在调用 ref 覆盖默认推断时传递一个泛型参数

```typescript
const foo = ref<string | number>('foo') // foo 的类型：Ref<string | number>

foo.value = 123 // ok!
```

如果泛型的类型未知，建议将 ref 转换为`Ref<T>`：

```typescript
function useState<State extends string>(initial: State) {
  const state = ref(initial) as Ref<State> // state.value -> State extends string
  return state
}

```

### ① 实现最基础的`ref`

在实现`ref`之前，首先在`src/reactivity/__tests__`目录下创建`ref`的测试文件`ref.spec.ts`，并添加以下测试代码：

```typescript
describe('reactivity/ref', () => {
  it('should hold a value', () => {
    // 创建 ref 对象
    const a = ref(1)
    // ref 对象的 value property 的值等于传入的值
    expect(a.value).toBe(1)
    // ref 对象的 value property 的值是可变的
    a.value = 2
    expect(a.value).toBe(2)
  })

  it('should be reactive', () => {
    const a = ref(1)
    let dummy
    let calls = 0
    effect(() => {
      calls++
      dummy = a.value
    })
    expect(calls).toBe(1)
    expect(dummy).toBe(1)
    // ref 对象是响应式的
    a.value = 2
    expect(calls).toBe(2)
    expect(dummy).toBe(2)
    // ref 对象的 value property 的 set 具有缓存，不会重复触发依赖
    a.value = 2
    expect(calls).toBe(2)
    expect(dummy).toBe(2)
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下创建`ref.ts`文件，在其中实现一个不完全的`ref`并导出，在实现过程中利用`Ref`接口的实现类，对操作进行封装

```typescript
// ref 对象的接口
interface Ref {
  value
}

// Ref 接口的实现类，对操作进行封装
class RefImpl {
  private _value

  constructor(value) {
    // 将传入的值赋值给实例的私有 property _value
    this._value = value
  }

  // value property 的 get 返回私有 property _value 的值
  get value() {
    // TODO: 收集依赖

    // 返回实例的私有 property _value 的值
    return this._value
  }

  // value property 的 set 修改私有 property _value 的值
  set value(newVal) {
    // TODO: 触发依赖

    // 对 set 的值进行处理，将结果赋值给实例的私有 property _value
    this._value = newVal
  }
}

export function ref(value?: unknown): Ref {
    // 返回 RefImpl 类的实例，即 ref 对象
    return new RefImpl(value);
}
```

这样就实现了一个不完全的`ref`，即能够将传入的值转为 ref 对象。之后，从`src/reactivity/src`目录下的`effect.ts`文件中的`track`和`trigger`函数中抽离并导出`isTracking`、`trackEffects`和`triggerEffects`函数：

```typescript
export function track(target, key) {
  // 若不应该收集依赖则直接返回
  if (!isTracking()) {
    return
  }

  /* 其他代码 */

  trackEffects(dep)
}

// 用于判断是否应该收集依赖
export function isTracking() {
  return shouldTrack && activeEffect !== undefined
}

// 用于将当前正在执行的 ReactiveEffect 类的实例添加到 dep 中， 同时将 dep 添加到当前正在执行的 ReactiveEffect 类的实例的 deps property 中
export function trackEffects(dep) {
    // 若 dep 中包括当前正在执行的 ReactiveEffect 类的实例则直接返回
    if (dep.has(activeEffect!)) {
        return;
    }
    // 将当前正在执行的 ReactiveEffect 类的实例添加到 dep 中
    dep.add(activeEffect!);
    // 将 dep 添加到当前正在执行的 ReactiveEffect 类的实例的 deps property 中
    activeEffect!.deps.push(dep);
}

export function trigger(target, key) {
  /* 其他代码 */

  triggerEffects(dep)
}

// 用于遍历 dep，调用每一个 ReactiveEffect 类的实例的 scheduler 方法或 run 方法
export function triggerEffects(dep) {
  for (const reactiveEffect of dep) {
    if (reactiveEffect.scheduler) {
      reactiveEffect.scheduler()
    } else {
      reactiveEffect.run()
    }
  }
}
```

之后，在`RefImpl`类中创建私有 property `dep`用于保存与当前 ref 对象相关的依赖，在 value property 的 get 中收集依赖，在 set 中触发依赖：

```typescript
class RefImpl {
  private _value
  // 用于保存与当前 ref 对象相关的依赖
  private dep

  constructor(value) {
    this._value = value
    this.dep = new Set()
  }

  get value() {
    if (isTracking()) {
      // 收集依赖
      trackEffects(this.dep)
    }
    return this._value
  }

  set value(newVal) {
    // 若 set 的值与之前相同则直接返回
    if (!hasChanged(newVal, this._value)) {
      return
    }

    this._value = newVal
    // 触发依赖
    triggerEffects(this.dep)
  }
}

// share.js
export const hasChanged = (value: any, oldValue: any): boolean => !Object.is(value, oldValue);
```

### ② 完善`ref`

若传入的值是一个对象，需要利用`reactive`对该对象进行响应式转换。

在`ref`的测试文件`ref.spec.ts`中添加以下测试代码：

```typescript
describe('reactivity/ref', () => {
  /* 其他测试代码 */

  it('should make nested properties reactive', () => {
    const a = ref({
      count: 1
    })
    let dummy
    effect(() => {
      dummy = a.value.count
    })
    expect(dummy).toBe(1)
    // ref 对象的 value property 的是一个响应式对象
    a.value.count = 2
    expect(dummy).toBe(2)
  })
})
```

为了通过以上测试，需要对`ref`的实现进行完善。首先，在`src/reactivity/src`目录下的`reactive.ts`文件中实现并导出`toReactive`函数：

```typescript
// 用于对值进行处理，若为对象则利用 reactive 进行响应式处理，否则直接返回
export const toReactive = value => (isObject(value) ? reactive(value) : value)
```

之后，在`RefImpl`类中增加私有 property `_rawValue`用于保存用于保存传入的值和 set 的值，并在赋值给实例的私有 property `_value`之前利用`toReactive`函数对值进行处理：

```typescript
class RefImpl {
  // 用于保存传入的值和 set 的值
  private _rawValue
  private _value
  private dep

  constructor(value) {
    // 将传入的值赋值给实例的私有 property _rawValue
    this._rawValue = value
    // 对传入的值进行处理，将结果赋值给实例的私有 property _value
    this._value = toReactive(value)
    this.dep = new Set()
  }

  get value() {
    if (isTracking()) {
      trackEffects(this.dep)
    }

    return this._value
  }

  set value(newVal) {
    // 若 set 的值与之前不同则修改并触发依赖
    if (hasChanged(newVal, this._rawValue)) {
      // 将 set 的值赋值给实例的私有 property _rawValue
      this._rawValue = newVal
      // 对 set 的值进行处理，将结果赋值给实例的私有 property _value
      this._value = toReactive(newVal)
      // 触发依赖
      triggerEffects(this.dep)
    }
  }
}
```

## 实现`isRef`和`unref`

查看 [Vue3 API 文档中的响应性 API 部分](https://link.juejin.cn/?target=https%3A%2F%2Fv3.cn.vuejs.org%2Fapi%2Frefs-api.html)，找到`isRef`和`unRef`的介绍。

isRef检查值是否为一个 ref 对象。

unref如果参数是一个 ref，则返回内部值，否则返回参数本身。这是`val = isRef(val) ? val.value : val`的语法糖函数。

```typescript
function useFoo(x: number | Ref<number>) {
  const unwrapped = unref(x) // unwrapped 现在一定是数字类型
}
```

在实现`isRef`和`unRef`之前，首先在`ref`的测试文件`ref.spec.ts`中增加关于`isRef`和`unRef`的测试代码：

```typescript
describe('reactivity/ref', () => {
  it('isRef', () => {
    expect(isRef(ref(1))).toBe(true)
    expect(isRef(reactive({ foo: 1 }))).toBe(false)
    expect(isRef(0)).toBe(false)
    expect(isRef({ bar: 0 })).toBe(false)
  })

  it('unref', () => {
    expect(unref(1)).toBe(1)
    expect(unref(ref(1))).toBe(1)
  })
})
```

为了通过以上测试，首先在`RefImpl`类中增加共有 property `__v_isRef`用于标志实例是一个 ref 对象，之后，在`src/reactivity/src`目录下的`ref.ts`文件中实现并导出`isRef`和`unRef`：

```typescript
class RefImpl {
  // 用于保存传入的值和 set 的值
  private _rawValue
  private _value
  // 用于保存与当前 ref 对象相关的依赖
  private dep
  // 用于标志实例是一个 ref 对象
  public __v_isRef = true
}

// 用于判断一个值是否是 ref 对象
export function isRef(value): boolean {
  return !!value.__v_isRef
}

// 用于获取 ref 对象的 value property 的值
export function unref(ref) {
  return isRef(ref) ? ref.value : ref
}
```

##  实现`proxyRefs`函数

`proxyRefs`函数接受一个对象作为参数，返回一个对该对象的 get 和 set 进行代理的 Proxy 的实例`proxy`，若该对象的某个 property 的值是一个 ref 对象，则可直接通过获取`proxy`的相应 property 的值获取该 ref 对象的传入的值，直接修改`proxy`的相应 property 的值修改该 ref 对象的传入的值或替换该 ref 对象。

在实现`proxyRefs`函数之前，首先在`ref`的测试文件`ref.spec.ts`中增加关于`proxyRefs`函数的测试代码：

```typescript
describe('reactivity/ref', () => {
  it('proxyRefs', () => {
    const obj = {
      foo: ref(1),
      bar: 'baz'
    }
    const proxyObj = proxyRefs(obj)
    expect(proxyObj.foo).toBe(1)
    expect(proxyObj.bar).toBe('baz')

    proxyObj.foo = 2
    expect(proxyObj.foo).toBe(2)

    proxyObj.foo = ref(3)
    expect(proxyObj.foo).toBe(3)
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下的`ref.ts`文件中实现并导出`proxyRefs`函数。

```typescript
export function proxyRefs(objectWithRefs) {
  // 返回 Proxy 的实例
  return new Proxy(objectWithRefs, {
    // 对传入的对象的 property 的 get 和 set 进行代理
    get: function (target, key) {
      // 获取传入的对象的 property 的值，再调用 unref 进行处理
      return unref(Reflect.get(target, key))
    },
    set: function (target, key, value) {
      const oldValue = target[key]
      // 若传入的对象的 property 的值是一个 ref 对象，而 set 的值不是一个 ref 对象，则修改该 ref 对象的值，否则直接修改                property 的值
      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      } else {
        return Reflect.set(target, key, value)
      }
    }
  })
}
```

## 实现`computed`

查看 [Vue3 API 文档中的响应性 API 部分](https://link.juejin.cn/?target=https%3A%2F%2Fv3.cn.vuejs.org%2Fapi%2Fcomputed-watch-api.html%23computed)，找到`computed`的介绍。

computed接受一个 getter 函数，并根据 getter 的返回值返回一个不可变的响应式 ref 对象

```typescript
const count = ref(1)
const plusOne = computed(() => count.value + 1)

console.log(plusOne.value) // 2

plusOne.value++ // 错误
```

或者，接受一个具有 get 和 set 函数的对象，用来创建可写的 ref 对象。

```typescript
const count = ref(1)
const plusOne = computed({
  get: () => count.value + 1,
  set: val => {
    count.value = val - 1
  }
})

plusOne.value = 1
console.log(count.value) // 0
```

类型声明：

```typescript
// 只读的
function computed<T>(
  getter: () => T,
  debuggerOptions?: DebuggerOptions
): Readonly<Ref<Readonly<T>>>

// 可写的
function computed<T>(
  options: {
    get: () => T
    set: (value: T) => void
  },
  debuggerOptions?: DebuggerOptions
): Ref<T>
interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}
interface DebuggerEvent {
  effect: ReactiveEffect
  target: any
  type: OperationTypes
  key: string | symbol | undefined
}
```

### ① 实现最基础的`computed`

在实现`computed`之前，在`src/reactivity/__tests__`目录下创建`computed`的测试文件`computed.spec.ts`，并添加以下测试代码：

```typescript
describe('reactivity/computed', () => {
  it('should return updated value', () => {
    const value = reactive({ foo: 1 })
    // 接受一个 getter 函数创建只读响应式 ref 对象，
    const cValue = computed(() => value.foo)
    expect(cValue.value).toBe(1)
    value.foo = 2
    expect(cValue.value).toBe(2)
  })
})
```

为了通过以上测试，在`src/reactivity/src`目录下创建`computed.ts`文件，在其中实现一个最基础的`computed`并导出，在实现过程中利用`Ref`接口的实现类，对操作进行封装，同时利用了`effect`的实现中抽离出的`ReactiveEffect`类，因此需要将`src/reactivity/src`目录下的`effect.ts`文件中的`ReactiveEffect`类导出：

```typescript
// effect.ts
export class ReactiveEffect {
  /* 具体实现 */
}

// computed.ts
// Ref 接口的实现类
class ComputedImpl {
  // 用于保存 ReactiveEffect 类的实例
  private _effect: ReactiveEffect

  constructor(getter) {
    // 利用 getter 函数创建 ReactiveEffect 类的实例
    this._effect = new ReactiveEffect(getter)
  }

  // value property 的 get 返回调用私有 property _effect 的 run 方法的返回值，即调用 getter 函数的返回值
  get value() {
    return this._effect.run()
  }
}

export function computed(getter) {
  // 返回 RefImpl 类的实例，即 ref 对象
  return new ComputedImpl(getter)
}
```

### ② 完善`computed`

`computed`会懒执行 getter 函数，同时响应式 ref 对象的 value property 的 get 具有缓存。

处理穿参若为{ get(){ },set(){ } }时

在`computed`的测试文件`computed.spec.ts`中添加以下测试代码：

```typescript
describe('reactivity/computed', () => {
  it('should compute lazily', () => {
    const value = reactive({ foo: 1 })
    const getter = jest.fn(() => value.foo)
    const cValue = computed(getter)

    // 在获取 ref 对象的 value property 的值时才执行 getter
    expect(getter).not.toHaveBeenCalled()
    expect(cValue.value).toBe(1)
    expect(getter).toHaveBeenCalledTimes(1)
    // 若依赖的响应式对象的 property 的值没有更新，则再次获取 ref 对象的 value property 的值不会重复执行 getter
    cValue.value
    expect(getter).toHaveBeenCalledTimes(1)
    // 修改依赖的响应式对象的 property 的值时不会执行 getter
    value.foo = 1
    expect(getter).toHaveBeenCalledTimes(1)

    // 在依赖的响应式对象的 property 的值没有更新后，获取 ref 对象的 value property 的值再次执行 getter
    expect(cValue.value).toBe(1)
    expect(getter).toHaveBeenCalledTimes(2)
    cValue.value
    expect(getter).toHaveBeenCalledTimes(2)
  })
})
```

为了通过以上测试，需要对computed的实现进行完善。

```typescript
import { effect } from './effect';
import { isFunction } from '../shared/index';
// Ref 接口的实现类
class ComputedImpl {
    private _runner;
    // 用于保存 getter 函数的执行结果
    private _value;
    // 用于记录是否 不使用缓存
    private _dirty = true;
    private _setter?;
    constructor(getter, setter) {
        this._setter = setter;
        // 利用 getter 函数和一个方法创建 ReactiveEffect 类的实例
        this._runner = effect(getter, {
            lazy: true,
            scheduler: () => {
                if (!this._dirty) {
                    // 用于关闭缓存
                    this._dirty = true;
                }
            }
        });
    }

    // value property 的 get 返回调用私有 property _effect 的 run 方法的返回值，即调用 getter 函数的返回值
    get value() {
        if (this._dirty) {
            // 调用 ReactiveEffect 类的实例的 run 方法，即执行 getter 函数，将结果赋值给 _value property
            this._value = this._runner.effect.run();
            this._dirty = false;
        }

        return this._value;
    }
    set value(newValue) {
        this._setter(newValue);
    }
}
/* 处理参数为 {
get(){},
set(newVal){
   ....
}
} */
export function computed(getterOrOption) {
    let getter, setter;
    if (isFunction(getterOrOption)) {
        getter = getterOrOption;
        setter = () => {
            console.warn('computed is readonly');
        };
    } else {
        getter = getterOrOption.get;
        setter = getterOrOption.set;
    }
    // 返回 RefImpl 类的实例，即 ref 对象
    return new ComputedImpl(getter, setter);
}

// ../shared/index (新增判断是否为函数)
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

```


