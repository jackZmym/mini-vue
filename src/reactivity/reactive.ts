import { trigger, track } from './effect';
export function reactive(raw) {
    // 返回 Proxy 的实例
    return new Proxy(raw, {
        // 对原始对象的 property 的 get 和 set 进行代理
        get(target, key, receiver) {
            const res = Reflect.get(target, key, receiver);
            // 收集依赖
            track(target, key);
            return res;
        },
        set(target, key, value, receiver) {
            const res = Reflect.set(target, key, value, receiver);
            // 触发依赖
            trigger(target, key);
            return res;
        }
    });
}
