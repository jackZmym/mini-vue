import {
  shallowReadonly,
  isReactive,
  isReadonly,
  isShallow
} from '@mini-vue/reactivity'
describe('reactivity/shallowReadonly', () => {
  test('should not make non-reactive properties reactive', () => {
    const props = shallowReadonly({ n: { foo: 1 } })
    console.warn = jest.fn()
    expect(isReactive(props.n)).toBe(false)
    expect(isReadonly(props.n)).toBe(false)
    props.n = { foo: 2 }
    expect(console.warn).toBeCalled()
    props.n.foo++
    expect(props.n.foo).toBe(2)
    expect(isShallow(props)).toBe(true)
  })
})
