import { h, ref } from '../../dist/mini-vue.esm-bundler.js'
export default {
  name: 'App',
  setup() {
    // 响应式数据
    const count = ref(0)

    const onClick = () => {
      // 修改响应式数据
      count.value++
    }

    return {
      count,
      onClick
    }
  },
  render() {
    return h(
      'div',
      {
        id: 'root'
      },
      [
        h('p', {}, `count: ${this.count}`),
        h(
          'button',
          {
            onClick: this.onClick
          },
          'plus 1'
        )
      ]
    )
  }
}
