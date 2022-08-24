/* Bar.js */
import { h, renderSlots } from '../../dist/mini-vue.esm-bundler.js'
// Bar 组件选项对象
export const Bar = {
  name: 'Bar',
  setup() {
    return {}
  },
  render() {
    return h('div', {}, [
      // 通过在调用 renderSlots 时传入第二个参数指定在此位置渲染的插槽
      renderSlots(this.$slots, 'header'),
      h('p', {}, 'bar component'),
      renderSlots(this.$slots, 'footer'),
      'Bar--component'
    ])
  }
}
