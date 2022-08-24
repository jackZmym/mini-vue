/* componentSlots.ts */

import { isObject, ShapeFlags } from '@mini-zsm-vue/shared'

// 用于将 children 赋值给组件实例对象的 slots property
export function initSlots(instance, children) {
  // 通过解构赋值获得组件对应的 VNode
  const { vnode } = instance
  // 若 children 是插槽则进行处理
  if (typeof children === 'string' || Array.isArray(children)) {
    //默认插槽且为字符串
    instance.slots['default'] = normalizeSlotValue(children)
  } else if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    //具名插槽
    normalizeObjectSlots(children, instance.slots)
  }
}

// 用于遍历 children，将创建插槽对应的 VNode 数组的函数挂载到组件实例对象的 slots property 上
function normalizeObjectSlots(children, slots) {
  if (isObject(children)) {
    for (const key in children) {
      const value = children[key]
      slots[key] =
        typeof value === 'function'
          ? props => normalizeSlotValue(value(props))
          : normalizeSlotValue(value)
    }
  }
}

// 用于将一个 VNode 转为数组
function normalizeSlotValue(value) {
  return Array.isArray(value) ? value : [value]
}
