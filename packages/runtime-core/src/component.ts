/* component.ts */

import { proxyRefs, shallowReadonly } from '@mini-jackz-vue/reactivity'
import { emit } from './componentEmit'
import { initProps } from './componentProps'
import { PublicInstanceHandlers } from './componentPublicInstance'
import { initSlots } from './componentSlots'
// 用于保存当前组件实例对象
let currentInstance = null

// 用于获取当前组件的实例对象
export function getCurrentInstance() {
  return currentInstance
}

// 用于给全局变量 currentInstance 赋值
function setCurrentInstance(instance) {
  currentInstance = instance
}

// 用于创建组件实例对象
export function createComponentInstance(vnode, parent) {
  const component = {
    vnode,
    type: vnode.type,
    setupState: {},
    props: {},
    slots: {},
    // 若存在父组件则赋值为 父组件实例对象的 provides property，否则为空对象
    provides: parent ? parent.provides : {},
    parent,
    proxy: null,
    isMounted: false,
    emit: () => {}
  }
  // 通过 Function.prototype.bind() 将 emit 函数第一个参数指定为组件实例对象，将新函数挂载到组件实例对象上
  component.emit = emit.bind(null, component) as any
  return component
}

// 用于初始化 props、初始化 slots 和调用 setup 以及设置 render 函数
export function setupComponent(instance) {
  // 将组件对应 VNode 的 props property 挂载到组件实例对象上
  initProps(instance, instance.vnode.props)

  // 将 children 挂载到组件实例对象的 slots property 上
  initSlots(instance, instance.vnode.children)

  setupStatefulComponent(instance)
}

// 用于初始化有状态的组件（相对的是没有状态的函数式组件）
function setupStatefulComponent(instance) {
  // 通过组件实例对象的 type property 获取组件选项对象
  const Component = instance.type

  // 利用 Proxy 对组件实例对象的 proxy property 的 get 进行代理
  instance.proxy = new Proxy({ _: instance }, PublicInstanceHandlers)
  // 通过解构赋值获取组件选项对象中的 setup
  const { setup } = Component
  let setupResult = {}
  if (setup) {
    // 将全局变量 currentInstance 赋值为当前组件实例对象
    setCurrentInstance(instance)

    // 调用 setup 传入 props 对象的 shallowReactive 响应式副本和包含 emit 方法的对象并获取其返回值
    setupResult = setup(shallowReadonly(instance.props), {
      emit: instance.emit
    })

    // 将全局变量 currentInstance 赋值为 null
    setCurrentInstance(null)
  }

  // 处理 setup 的返回值
  handleSetupResult(instance, setupResult)
}

// 用于处理 setup 的返回值
function handleSetupResult(instance, setupResult) {
  // 根据 setup 返回值类型的不同进行不同的处理
  // 若返回一个对象则调用 proxyRefs 并传入该对象，将返回值赋值给组件实例对象的 setupState property
  if (typeof setupResult === 'object') {
    instance.setupState = proxyRefs(setupResult)
  }
  // 若返回一个 function 则将其作为组件的 render 函数
  else if (typeof setupResult === 'function') {
    // TODO: 处理 function
  }

  finishComponentSetup(instance)
}

// 用于设置 render 函数
function finishComponentSetup(instance) {
  // 通过组件实例对象的 type property 获取组件选项对象
  const Component = instance.type

  // 将组件选项对象中的 render 函数挂载到组件实例对象上
  if (Component.render) {
    instance.render = Component.render
  }
}
