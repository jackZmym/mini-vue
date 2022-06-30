import { effect, stop } from '@/reactivity/effect';
import { reactive } from '@/reactivity/reactive';
describe('effect', () => {
    /* effect执行后返回值测试代码 */
    it('should return a function to be called manually', () => {
        let foo = 0;
        // 用一个变量 runner 接受 effect 执行返回的函数
        const runner = effect(() => {
            foo++;
            return 'foo';
        });
        expect(foo).toBe(1);
        // 调用 runner 时会再次执行传入的函数
        const res = runner();
        expect(foo).toBe(2);
        // runner 执行返回该函数的返回值
        expect(res).toBe('foo');
    });

    /* effect增加options 测试代码 */
    it('scheduler', () => {
        let dummy;
        let run: number;
        // 创建 mock 函数
        const scheduler = jest.fn(() => {
            run++;
        });
        const obj = reactive({ foo: 1 });
        const runner = effect(
            () => {
                dummy = obj.foo;
            },
            { scheduler }
        );
        // 程序运行时会首先执行传入的函数，而不会调用 scheduler 方法
        expect(scheduler).not.toHaveBeenCalled();
        expect(dummy).toBe(1);
        // 当传入的函数依赖的响应式对象的 property 的值更新时，会调用 scheduler 方法而不会执行传入的函数
        obj.foo++;
        expect(scheduler).toHaveBeenCalledTimes(1);
        expect(dummy).toBe(1);
        // 只有当调用 runner 时才会执行传入的函数
        runner();
        expect(scheduler).toHaveBeenCalledTimes(1);
        expect(dummy).toBe(2);
    });

    it('stop', () => {
        let dummy;
        const obj = reactive({ prop: 1 });
        const runner = effect(() => {
            dummy = obj.prop;
        });
        obj.prop = 2;
        expect(dummy).toBe(2);
        // 调用 stop 后，当传入的函数依赖的响应式对象的 property 的值更新时不会再执行该函数
        stop(runner);
        obj.prop = 3;
        expect(dummy).toBe(2);
        obj.prop++;
        expect(dummy).toBe(2);
        // 只有当调用`runner`时才会恢复执行该函数
        runner();
        expect(dummy).toBe(4);
    });
    // 测试onStop
    it('events: onStop', () => {
        // 创建 mock 函数
        const onStop = jest.fn();
        const runner = effect(() => {}, {
            onStop,
            num: 100
        });
        // 调用 stop 时，会执行 onStop 方法
        stop(runner);
        expect(runner.effect.num).toBe(100);
        expect(onStop).toHaveBeenCalled();
    });
});
