/* Foo.js */
import {
  h,
  renderSlots,
  getCurrentInstance
} from '../../dist/mini-zsm-vue.esm-bundler.js'
// Foo 组件选项对象
export const Foo = {
  name: 'Foo',
  setup() {
    // 获取当前组件实例对象
    const instance = getCurrentInstance()
    console.log('Foo:', instance)
    return {}
  },
  render() {
    //renderSlots 处理多个默认插槽数据
    return h('div', {}, [h('p', {}, 'Foo component'), renderSlots(this.$slots)])
  }
}
