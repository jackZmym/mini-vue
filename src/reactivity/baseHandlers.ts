import { track, trigger } from './effect';
import { ReactiveFlags } from './reactive';
// 对 get 和 set 进行缓存，防止重复调用工具函数
const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);

// 用于生成 get 函数的工具函数
function createGetter(isReadonly = false) {
    return function (target, key) {
        if (key === ReactiveFlags.IS_REACTIVE) {
            return !isReadonly;
        } else if (key === ReactiveFlags.IS_READONLY) {
            return isReadonly;
        }
        const res = Reflect.get(target, key);
        // 利用 reactive 进行响应式转换时才进行依赖收集
        if (!isReadonly) {
            // 收集依赖
            track(target, key);
        }
        return res;
    };
}

// 用于生成 set 函数的工具函数
function createSetter() {
    return function (target, key, value) {
        const res = Reflect.set(target, key, value);
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
