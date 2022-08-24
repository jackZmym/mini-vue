import { effect, stop, reactive } from '@mini-zsm-vue/reactivity'
describe('effect', () => {
  /* effect执行后返回值测试代码 */
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
  /* effect增加options 和reactive（reactive）引发问题 测试代码 */
  it('scheduler', () => {
    let dummy
    let run: number = 0
    // 创建 mock 函数
    const scheduler = jest.fn(() => {
      run++
    })
    const cs = reactive({ foo: 1 })
    const obj = reactive(cs)
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
    expect(run).toBe(1)
    expect(dummy).toBe(1)
    // 只有当调用 runner 时才会执行传入的函数
    runner()
    expect(scheduler).toHaveBeenCalledTimes(1)

    expect(dummy).toBe(2)
  })
  it('stop', () => {
    let dummy
    const obj = reactive({ prop: 1 })
    const runner = effect(() => {
      dummy = obj.prop
    })
    obj.prop = 2
    expect(dummy).toBe(2)
    // 调用 stop 后，当传入的函数依赖的响应式对象的 property 的值更新时不会再执行该函数
    stop(runner)
    obj.prop = 3
    expect(dummy).toBe(2)
    obj.prop++
    expect(dummy).toBe(2)
    // 只有当调用`runner`时才会恢复执行该函数
    runner()
    expect(dummy).toBe(4)
    obj.prop++
    expect(dummy).toBe(4)
  })
  // 测试onStop
  it('events: onStop', () => {
    // 创建 mock 函数
    const onStop = jest.fn()
    const runner = effect(() => {}, {
      onStop,
      num: 100
    })
    // 调用 stop 时，会执行 onStop 方法
    stop(runner)
    expect(runner.effect.num).toBe(100)
    expect(onStop).toHaveBeenCalled()
  })
  it('should avoid infinite loops with other effects', () => {
    const nums = reactive({ num1: 0, num2: 1 })
    const spy1 = jest.fn(() => (nums.num1 = nums.num2))
    const spy2 = jest.fn(() => (nums.num2 = nums.num1))
    effect(spy1)
    effect(spy2)
    expect(nums.num1).toBe(1)
    expect(nums.num2).toBe(1)
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)
    nums.num2 = 4
    expect(nums.num1).toBe(4)
    expect(nums.num2).toBe(4)
    expect(spy1).toHaveBeenCalledTimes(2)
    expect(spy2).toHaveBeenCalledTimes(2)
    nums.num1 = 10
    expect(nums.num1).toBe(10)
    expect(nums.num2).toBe(10)
    expect(spy1).toHaveBeenCalledTimes(3)
    expect(spy2).toHaveBeenCalledTimes(3)
  })
  // 可以避免隐性递归导致的无限循环
  it('should avoid implicit infinite recursive loops with itself', () => {
    const counter = reactive({ num: 0 })

    const counterSpy = jest.fn(() => counter.num++)
    effect(counterSpy)
    expect(counter.num).toBe(1)
    expect(counterSpy).toHaveBeenCalledTimes(1)
    counter.num = 4
    expect(counter.num).toBe(5)
    expect(counterSpy).toHaveBeenCalledTimes(2)
  })
  it('test defstop for stop effect', () => {
    const jestFn = jest.fn(() => console.log(counter.num))
    const counter = reactive({ num: 0 })
    const runner = effect(() => {
      if (counter.num > 0) {
        stop(runner)
        jestFn()
      }
    })
    counter.num++
    expect(jestFn).toHaveBeenCalledTimes(1)
    counter.num++
    expect(jestFn).toHaveBeenCalledTimes(1)
  })
})
