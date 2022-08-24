/* componentProps.ts */

// 用于将 props 对象挂载到组件实例对象上
export function initProps(instance, rawProps) {
  instance.props = rawProps || {}
}
