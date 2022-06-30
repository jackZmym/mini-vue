import { reactive } from '@/reactivity/reactive';
describe('reactivity/reactive', () => {
    it('Object', () => {
        const original = { foo: 1 };
        // reactive 返回对象的响应式副本
        const observed = reactive(original);
        // observed !== original
        expect(observed).not.toBe(original);
        // observed 的 property 的值与 original 的相等
        expect(observed.foo).toBe(1);
    });
});
