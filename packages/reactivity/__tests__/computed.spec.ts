import { reactive, computed, effect } from '@mini-jackz-vue/reactivity'
describe('reactivity/computed', () => {
  it('should return updated value', () => {
    const value = reactive({ foo: 1 })
    // 接受一个 getter 函数创建只读响应式 ref 对象，
    const cValue = computed(() => value.foo)
    expect(cValue.value).toBe(1)
    value.foo = 2
    expect(cValue.value).toBe(2)
  })

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
    value.foo = 2
    expect(getter).toHaveBeenCalledTimes(1)

    // 在依赖的响应式对象的 property 的值没有更新后，获取 ref 对象的 value property 的值再次执行 getter
    expect(cValue.value).toBe(2)
    expect(getter).toHaveBeenCalledTimes(2)
    cValue.value
    expect(getter).toHaveBeenCalledTimes(2)
  })
  it('effect of computed', () => {
    let test = reactive({ num: 1 })
    let ctest = computed(() => test.num)
    console.log = jest.fn()
    effect(() => {
      console.log(ctest.value, 'computed value')
      test.num = 100
    })
    expect(console.log).toBeCalledTimes(1)
    ctest.value
    test.num = 200
    expect(console.log).toBeCalledTimes(2)
    test.num = 300
    expect(console.log).toBeCalledTimes(2)
    ctest.value
    test.num = 400
    expect(console.log).toBeCalledTimes(3)
  })
})
