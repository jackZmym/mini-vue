/* renderer.ts */

import { ShapeFlags } from '@mini-vue/shared'
import { createComponentInstance, setupComponent } from './component'
import { createAppAPI } from './apiCreateApp'
import { createTextVNode, Fragment, Text } from './vnode'
import { effect } from '@mini-vue/reactivity'

export function createRenderer(options) {
  // 通过解构赋值获取 createText 函数、createElement 函数、patchProp 函数和 insert 函数
  const {
    createText: hostCreateText,
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    insert: hostInsert
  } = options
  // 用于处理 VNode
  function render(vnode, container) {
    patch(null, vnode, container, null)
  }
  // 用于处理组件对应的 VNode
  function patch(n1, n2, container, parentComponent) {
    // 根据 VNode 类型的不同调用不同的函数
    // 通过 VNode 的 shapeFlag property 与枚举变量 ShapeFlags 进行与运算来判断 VNode 类型
    const { type, shapeFlag } = n2

    // 通过 VNode 的 type property 判断 VNode 类型是 Fragment 或其他
    switch (type) {
      case Fragment:
        processFragment(n1, n2, container, parentComponent)
        break
      case Text:
        processText(n1, n2, container)
        break
      default:
        // 通过 VNode 的 shapeFlag property 与枚举变量 ShapeFlags 进行与运算来判断 VNode 类型是 Element 或 Component
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, parentComponent)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container, parentComponent)
        }
        break
    }
  }
  // 用于处理 Text
  function processText(n1, n2, container) {
    // 通过解构赋值获取 Text 对应 VNode 的 children，即文本内容
    const { children } = n2
    // createText 函数 --- 利用 document.createTextNode() 创建文本节点
    const textNode = hostCreateText(children)
    // insert 函数 利用 Element.append() 将该节点添加到根容器/其父元素中
    hostInsert(textNode, container)
  }
  // 用于处理 Fragment
  function processFragment(n1, n2, container, parentComponent) {
    mountChildren(n2.children, container, parentComponent)
  }

  // 用于处理 Element
  function processElement(n1, n2, container, parentComponent) {
    // 若旧 VNode 不存在则初始化 Element
    if (!n1) {
      mountElement(n2, container, parentComponent)
    }
    // 否则更新 Element
    else {
      //  更新 Element
      patchElement(n1, n2, container)
    }
  }
  // 用于更新 Element
  function patchElement(n1, n2, container) {
    const oldProps = n1.props || {}
    const newProps = n2.props || {}

    // 获取旧 VNode 的 el property 并将其挂载到新 VNode 上
    const el = (n2.el = n1.el)

    patchProps(el, oldProps, newProps)
  }

  // 用于更新 Element 的 props
  function patchProps(el, oldProps, newProps) {
    if (oldProps !== newProps) {
      // 遍历新 VNode 的 props 对象
      for (const key in newProps) {
        const prev = oldProps[key]
        const next = newProps[key]

        // 若新旧 VNode 的 props 对象中的 property 或方法不相等
        if (prev !== next) {
          // 将新 VNode 的 property 或方法挂载到元素上
          hostPatchProp(el, key, next)
        }
      }

      // 遍历旧 VNode 的 props 对象
      for (const key in oldProps) {
        // 若新 VNode 的 props 对象中不包含该 property 或方法
        if (!(key in newProps)) {
          // 将元素上该 property 或方法赋值为 null
          hostPatchProp(el, key, null)
        }
      }
    }
  }
  // 用于初始化 Element
  function mountElement(vnode, container, parentComponent) {
    // 根据 Element 对应 VNode 的 type property 创建 DOM 元素并挂载到 VNode 上 (利用document.createElement创建)
    const el = (vnode.el = hostCreateElement(vnode.type))

    // 通过解构赋值获取 Element 对应 VNode 的 props 对象、shapeFlag property 和 children
    const { props, shapeFlag, children } = vnode

    // 遍历 props 对象，利用 Element.setAttribute() 将其中的 property 挂载到新元素上
    // 其中 key 作为新元素的 attribute 或 property 名，value 作为 attribute 或 property 的值
    for (const key in props) {
      const val = props[key]
      // patchProp 函数
      hostPatchProp(el, key, val)
    }

    // 通过 VNode 的 shapeFlag property 与枚举变量 ShapeFlags 进行与运算来判断 children 类型
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      el.textContent = children
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(children, el, parentComponent)
    }
    // insert 函数 利用 Element.append() 将新元素添加到根容器/其父元素中
    hostInsert(el, container)
  }

  // 用于遍历 children，对其中每个 VNode 调用 patch 方法进行处理
  function mountChildren(children, container, parentComponent) {
    children.forEach(child => {
      let vnode = typeof child === 'string' ? createTextVNode(child) : child
      patch(null, vnode, container, parentComponent)
    })
  }
  // 用于处理 Component
  function processComponent(n1, n2, container, parentComponent) {
    mountComponent(n2, container, parentComponent)
  }

  // 用于初始化 Component
  function mountComponent(vnode, container, parentComponent) {
    // 通过组件对应的 VNode 创建组件实例对象，用于挂载 props、slots 等
    const instance = createComponentInstance(vnode, parentComponent)
    setupComponent(instance)

    setupRenderEffect(instance, vnode, container)
  }

  // 用于处理 VNode 树
  function setupRenderEffect(instance, vnode, container) {
    // 利用 effect 将调用 render 函数和 patch 方法的操作收集
    effect(() => {
      // 根据组件实例对象的 isMounted property 判断是初始化或更新 VNode 树
      // 若为 false 则是初始化
      if (!instance.isMounted) {
        const { proxy } = instance

        const subTree = (instance.subTree = instance.render.call(proxy))

        patch(null, subTree, container, instance)

        vnode.el = subTree.el

        // 将组件实例对象的 isMounted property 赋值为 true
        instance.isMounted = true
      }
      // 否则是更新
      else {
        //  更新 VNode 树
        // 通过解构赋值获取组件实例对象的 proxy property 和旧 VNode 树
        const { proxy, subTree: preSubTree } = instance

        // 调用组件实例对象中 render 函数获取新 VNode 树，同时将 this 指向指定为 proxy property，并将其挂载到组件实例对象上
        const subTree = (instance.subTree = instance.render.call(proxy))

        // 调用 patch 方法处理新旧 VNode 树
        patch(preSubTree, subTree, container, instance)
      }
    })
  }
  return {
    createApp: createAppAPI(render)
  }
}
