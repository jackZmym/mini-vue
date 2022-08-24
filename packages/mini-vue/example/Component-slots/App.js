/* App.js */
import {
  h,
  ref,
  createTextVNode,
  getCurrentInstance
} from '../../dist/mini-zsm-vue.esm-bundler.js'
import { Foo } from './Foo.js'
import { Bar } from './Bar.js'
import { Baz } from './Baz.js'
// 根组件选项对象
export const App = {
  name: 'App',
  setup() {
    // 获取当前组件实例对象
    const instance = getCurrentInstance()
    console.log('App:', instance)
    return {}
  },
  render() {
    // 传入一个 VNode 作为插槽
    // return h(Foo, {}, 'a slot')
    return h(Foo, {}, [h('p', {}, 'a  text defalut slot')])
    // 传入一个 VNode 数组，数组中每一项为一个插槽
    return h(Foo, {}, [h('p', {}, 'a slot'), h('p', {}, 'another slot')])
    // 传入一个对象，对象中每个 property 为一个插槽
    return h(
      Bar,
      {},
      {
        header: [h('p', {}, 'header slot')],
        footer: h('p', {}, 'footer slot')
      }
    )

    // 传入一个对象，对象中的每个方法为一个创建插槽的函数
    return h(
      Baz,
      {},
      {
        content: props => [
          h('p', {}, 'content: ' + props.msg),
          createTextVNode('a text node')
        ]
      }
    )
  }
}
