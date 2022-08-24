/* Baz.js */
import { h, renderSlots } from '../../dist/mini-vue.esm-bundler.js'
// Baz 组件选项对象
export const Baz = {
  name: 'Baz',
  setup() {
    return {}
  },
  render() {
    const msg = 'this is a slot'
    // 通过在调用 renderSlots 函数时传入第三个参数指定传入插槽函数的参数
    return h('div', {}, [
      renderSlots(this.$slots, 'content', {
        msg
      }),
      h('p', {}, 'Baz--component')
    ])
  }
}
