import { mutableHandlers, readonlyHandlers } from './baseHandlers';
import { isObject } from '../shared/index';
export const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive',
    IS_READONLY = '__v_isReadonly',
    RAW = '__v_raw'
}
export interface Target {
    [ReactiveFlags.IS_REACTIVE]?: boolean; // target 是否是响应式
    [ReactiveFlags.IS_READONLY]?: boolean; // target 是否是只读
    [ReactiveFlags.RAW]?: any; // 表示 proxy 对应的源数据，target 已经是 proxy 对象时会有该属性
}
export const reactiveMap = new WeakMap<Target, any>();
export const readonlyMap = new WeakMap<Target, any>();
// export const shallowReactiveMap = new WeakMap<Target, any>();
// export const shallowReadonlyMap = new WeakMap<Target, any>();
export function reactive(target) {
    // 如果目标对象是一个只读的响应数据,则直接返回目标对象
    if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
        return target;
    }
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
    // 已经经是响应式的就直接返回(取ReactiveFlags.RAW 属性会返回true，因为进行reactive的过程中会用weakMap进行保存，通过target能判断出是否有ReactiveFlags.RAW属性)
    // 例外：对reactive对象进行readonly()得出结果为reactive()
    if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
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
