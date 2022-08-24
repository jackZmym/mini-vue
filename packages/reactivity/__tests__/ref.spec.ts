import {
  ref,
  isRef,
  unref,
  proxyRefs,
  shallowRef,
  reactive,
  isReactive,
  effect
} from '@mini-jackz-vue/reactivity'

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
  it('should make nested properties reactive', () => {
    const a = ref(1)
    let dummy
    effect(() => {
      dummy = a.value
    })
    expect(dummy).toBe(1)
    // ref 对象的 value property 的是一个响应式对象
    a.value = 2
    expect(dummy).toBe(2)
  })
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
  it('shallowRef', () => {
    let shallow = shallowRef({ num: 1 })
    expect(isRef(shallow)).toBe(true)
    expect(isReactive(shallow.value)).toBe(false)
    let refDeep = ref({ num: 1 })
    expect(isRef(refDeep)).toBe(true)
    expect(isReactive(refDeep.value)).toBe(true)
  })
})
