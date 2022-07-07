import { track, trigger } from './effect';
import { ReactiveFlags, readonly, reactive, readonlyMap, reactiveMap } from './reactive';
import { isObject } from '../shared/index';
// 对 get 和 set 进行缓存，防止重复调用工具函数
const get = createGetter();
const set = createSetter();
// 只读的get
const readonlyGet = createGetter(true);
// 用于生成 get 函数的工具函数
function createGetter(isReadonly = false) {
    return function (target, key, receiver) {
        //  ReactiveFlags 是在reactive中声明的枚举值，如果key是枚举值则直接返回对应的布尔值
        if (key === ReactiveFlags.IS_REACTIVE) {
            return !isReadonly;
        } else if (key === ReactiveFlags.IS_READONLY) {
            return isReadonly;
        } else if (
            // 如果key是raw  receiver 指向调用者，则直接返回目标对象。
            // 这里判断是为了保证触发拦截 handle 的是 proxy 本身而不是 proxy 的继承者
            // 触发拦的两种方式：一是访问 proxy 对象本身的属性，二是访问对象原型链上有 proxy 对象的对象的属性，因为查询会沿着原型链向下找
            key === ReactiveFlags.RAW &&
            receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)
        ) {
            return target;
        }
        const res = Reflect.get(target, key, receiver);
        // 利用 reactive 进行响应式转换时才进行依赖收集
        if (!isReadonly) {
            // 收集依赖
            track(target, key);
        }
        // 由于 proxy 只能代理一层，如果子元素是对象，需要递归继续代理
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}

// 用于生成 set 函数的工具函数
function createSetter() {
    return function (target, key, value, receiver) {
        const res = Reflect.set(target, key, value, receiver);
        // 触发依赖
        trigger(target, key);
        return res;
    };
}

// reactive 对应的 handlers
export const mutableHandlers: ProxyHandler<any> = {
    get,
    set
};

// readonly 对应的 handlers
export const readonlyHandlers: ProxyHandler<any> = {
    get: readonlyGet,
    set(target, key) {
        // 调用 console.warn 发出警告
        console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
        return true;
    }
};
