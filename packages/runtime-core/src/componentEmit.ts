/* componentEmit.ts */
/* 
实现并导出emit函数。这里用到了 TPP 的开发思路，
即先针对一个特定行为进行编码，再对代码进行重构以适用于通用行为，
比如这里就将调用组件时在props对象中声明的方法指定为 onBar 方法：
*/

import { camelize, toHandlerKey } from '@mini-zsm-vue/shared'

// 用于调用 props 对象中的指定方法
export function emit(instance, event, ...args) {
  // 通过解构赋值获取组件实例对象的 props property
  const { props } = instance

  const handlerName = toHandlerKey(camelize(event))
  const handler = props[handlerName]
  handler && handler(...args)
}
