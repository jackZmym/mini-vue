import { isReactive, shallowReactive, isShallow } from '@mini-vue/reactivity'
import { effect } from '../src/effect'
describe('shallowReactive', () => {
  test('should not make non-reactive properties reactive', () => {
    const props = shallowReactive({ n: { foo: 1 }, shallow: 1 })
    const fn = jest.fn()
    effect(() => {
      console.log(props.shallow)
      fn()
    })
    expect(isReactive(props.n)).toBe(false)
    props.shallow++
    expect(props.shallow).toBe(2)
    expect(fn).toBeCalled()
    expect(isShallow(props)).toBe(true)
  })
})
