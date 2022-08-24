import { reactive, isReactive, isProxy } from '@mini-jackz-vue/reactivity'
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
  it('reactive of Reactive', () => {
    const original = { foo: 1 }
    // reactive 返回对象的响应式副本
    const observed = reactive(original)
    const muObserved = reactive(observed)
    muObserved.foo++
    expect(muObserved.foo).toBe(2)
    expect(observed.foo).toBe(2)
    // observed !== original
    expect(observed).toBe(muObserved)
  })
  it('isProxy', () => {
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
