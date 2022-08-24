// import { render } from './renderer'
import { createVNode } from './vnode'

// 用于返回 createApp
export function createAppAPI(render) {
  return function createApp(rootComponent) {
    const app = {
      component() {},
      directive() {},
      use() {},
      // 用于将应用挂载到根容器中
      mount(rootContainer) {
        // 将根组件转换为 VNode
        const vnode = createVNode(rootComponent)
        render(vnode, rootContainer)
        return app
      }
    }
    return app
  }
}
