import {
  mutableHandlers,
  readonlyHandlers,
  shallowHandlers,
  shallowReadonlyHandlers
} from './baseHandlers'
import { isObject } from '@mini-vue/shared'
export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}
export interface Target {
  [ReactiveFlags.IS_REACTIVE]?: boolean // target 是否是响应式
  [ReactiveFlags.IS_READONLY]?: boolean // target 是否是只读
  [ReactiveFlags.IS_SHALLOW]?: boolean // target 是否是浅响应
  [ReactiveFlags.RAW]?: any // 表示 proxy 对应的源数据，target 已经是 proxy 对象时会有该属性
}
export const reactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()
export const shallowReactiveMap = new WeakMap<Target, any>()
export const shallowReadonlyMap = new WeakMap<Target, any>()
export function reactive(target) {
  // 如果目标对象是一个只读的响应数据,则直接返回目标对象
  if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
    return target
  }
  return createReactiveObject(target, false, mutableHandlers, reactiveMap)
}
export function readonly(target) {
  return createReactiveObject(target, true, readonlyHandlers, readonlyMap)
}
export function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowHandlers,
    shallowReactiveMap
  )
}
export function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyMap
  )
}
// 用于创建 Proxy 实例的工具函数
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  if (!isObject(target)) {
    // 不是对象直接返回
    return target
  }
  // 如果传入的已经是代理了 并且 不是readonly 转换 reactive的直接返回
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }
  // 查看当前代理对象之前是不是创建过当前代理，如果创建过直接返回之前缓存的代理对象
  // proxyMap 是一个全局的缓存WeakMap
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  // 返回 Proxy 的实例
  const proxy = new Proxy(target, baseHandlers)
  proxyMap.set(target, proxy)
  return proxy
}
export function isReactive(target: unknown): boolean {
  if (isReadonly(target)) {
    return isReactive((target as Target)[ReactiveFlags.RAW])
  }
  return !!(target && (target as Target)[ReactiveFlags.IS_REACTIVE])
}
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}
export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW])
}
// 用于检查对象是否是由 reactive 或 readonly 创建的响应式对象
export function isProxy(value: unknown): boolean {
  // 利用 isReactive 和 isReadonly 进行判断
  return isReactive(value) || isReadonly(value)
}
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
