/* App.js */
const { h, ref } = miniVue
import { Foo } from './Foo.js'
// 用于保存组件的 this
window.self = null
// 根组件选项对象
export const App = {
  // render 函数
  render() {
    window.self = this
    return h(
      'div',
      {
        id: 'root',
        class: 'root-div'
        // // 注册 onClick 事件
        // onClick() {
        //   console.log('you clicked root-div')
        // },
        // // 注册 onMousedown 事件
        // onMousedown() {
        //   console.log('your mouse down on root-div')
        // }
      },
      [
        `hello, ${this.name}`,
        // 创建 Foo 组件时在 props 对象中声明 count属性  onBar 方法和 onBarBaz 方法
        h(Foo, {
          count: this.number,
          onBar: (a, b) => {
            this.barChildClick(a, b)
          },
          onBarBaz(c, d) {
            console.log('onBarBaz 父组件接收', c, d)
          }
        })
      ]
    )
    // 在 render 函数中能够获取 setup 返回对象的 property
    // return h('div', { id: 'root', class: 'root' }, [
    //   h('p', { id: 'p1', class: 'p1' }, 'hello, mini-jackz-vue3'),
    //   h('p', { id: 'p2', class: 'p2' }, `${this.name}`)
    // ])
  },
  // composition API
  setup() {
    let name = ref('mini-jackz-vue3-TS')
    // 返回一个对象
    const barChildClick = (a, b) => {
      name.value = 'mini-jackz-vue3-TS-xxxxx'
      console.log('onBar 父组件接收 barChildClick', a, b)
    }
    return {
      name,
      number: 100,
      barChildClick
    }
  }
}
