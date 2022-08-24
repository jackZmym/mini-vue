export * from './shapeFlags'
export const extend = Object.assign
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'
// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'
// 用于判断对象中是否有某个 property
export const hasOwn = (val, key) =>
  Object.prototype.hasOwnProperty.call(val, key)

// 用于将带连字符的字符串转换为驼峰式
export const camelize = (str: string) => {
  return str.replace(/-(\w)/g, (_, c: string) => {
    return c ? c.toUpperCase() : ''
  })
}

// 用于将字符串首字母转换为大写
export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// 用于在字符串之前加上 on
export const toHandlerKey = (str: string) => {
  return str ? 'on' + capitalize(str) : ''
}
