import { mutableHandlers, readonlyHandlers } from './baseHandlers';
import { isObject } from '../shared/index';
export const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive',
    IS_READONLY = '__v_isReadonly'
}
export interface Target {
    [ReactiveFlags.IS_REACTIVE]?: boolean;
    [ReactiveFlags.IS_READONLY]?: boolean;
}
export const reactiveMap = new WeakMap<Target, any>();
export const readonlyMap = new WeakMap<Target, any>();
// export const shallowReactiveMap = new WeakMap<Target, any>();
// export const shallowReadonlyMap = new WeakMap<Target, any>();
export function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers, reactiveMap);
}
export function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyMap);
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
        return target;
    }
    // 如果不是Readonly 且为Reactive
    if (isReactive(target) && !isReadonly) {
        return target;
    }
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    // 返回 Proxy 的实例
    const proxy = new Proxy(target, baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}
export function isReactive(target: unknown): boolean {
    return !!(target && (target as Target)[ReactiveFlags.IS_REACTIVE]);
}
export function isReadonly(value: unknown): boolean {
    return !!(value && (value as Target)[ReactiveFlags.IS_READONLY]);
}
// 用于检查对象是否是由 reactive 或 readonly 创建的响应式对象
export function isProxy(value: unknown): boolean {
    // 利用 isReactive 和 isReadonly 进行判断
    return isReactive(value) || isReadonly(value);
}
