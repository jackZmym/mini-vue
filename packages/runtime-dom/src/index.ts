import { createRenderer } from '@mini-vue/runtime-core'
import { patchProp } from './patchProp'

// 用于创建元素
function createElement(type) {
  // 利用 document.createElement() 创建 DOM 元素
  return document.createElement(type)
}
// 用于将元素添加到根容器/父元素中
function insert(el, parent) {
  // 利用 Element.append() 将元素添加到根容器/父元素中
  parent.append(el)
}

// 用于创建文本节点
function createText(text) {
  // 利用 document.createTextNode() 创建文本节点
  return document.createTextNode(text)
}

// 调用 createRenderer 函数，并传入包含 createText 函数、createElement 函数、patchProp 函数和 insert 函数的对象
const renderer: any = createRenderer({
  createElement,
  patchProp,
  insert,
  createText
})

// 用于创建应用实例
export function createApp(...args) {
  // 调用 createRenderer 函数返回对象的 createApp 方法
  return renderer.createApp(...args)
}
export * from '@mini-vue/runtime-core'
