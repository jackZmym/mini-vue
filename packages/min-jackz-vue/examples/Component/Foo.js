/* Foo.js */
const { h, ref } = miniJackzVue
// Foo 组件选项对象
window.selfF = null
export const Foo = {
  render() {
    window.selfF = this
    const btnBar = h(
      'button',
      {
        // 在 render 函数中通过 this 获取 setup 返回对象的方法
        onClick: this.emitBar
      },
      'emitBar'
    )

    const btnBaz = h(
      'button',
      {
        onClick: this.emitBarBaz
      },
      'emitBarBaz'
    )
    // 在 render 函数中通过 this 获取 props 对象的 property 渲染按钮传值到父组件
    return h('div', {}, ['foo: ' + this.count, btnBar, btnBaz])
  },
  // props 对象是 setup 的第一个参数
  setup(props, { emit }) {
    console.log(props)

    // props 对象是只读的，但不是深度只读的
    props.count++
    console.log(props.count)

    const emitBar = () => {
      console.log('emit bar 子组件传值1,2')
      // 通过 emit 触发使用 Foo 组件时在 props 对象中声明的 onBar 方法
      emit('bar', 1, 2)
    }

    const emitBarBaz = () => {
      console.log('emit bar baz 子组件传值3,4')
      // 通过 emit 触发使用 Foo 组件时在 props 对象中声明的 onBarBaz 方法
      emit('bar-baz', 3, 4)
    }
    return {
      emitBar,
      emitBarBaz
    }
  }
}
