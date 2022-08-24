'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/* vnode.ts */
const Fragment = Symbol('Fragment');
const Text = Symbol('Text');
// 用于创建 Text 类型的 VNode
function createTextVNode(text) {
    return createVNode(Text, {}, text);
}
// 用于创建并返回 VNode
function createVNode(type, props, children) {
    const vnode = {
        // HTML 标签名、组件
        type,
        // 保存 attribute、prop 和事件的对象
        props,
        // 子 VNode
        children,
        // VNode 和 children 类型的标志位
        shapeFlag: getShapeFlag(type),
        // 对应组件的根元素
        el: null
    };
    // 根据 children 的类型设置 shapeFlag 对应的位
    if (typeof children === 'string') {
        vnode.shapeFlag |= 4 /* ShapeFlags.TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ShapeFlags.ARRAY_CHILDREN */;
    }
    // 若 VNode 类型为 Component 同时 children 类型为对象，则 children 为插槽，设置 shapeFlag 对应的位
    if (vnode.shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
        if (typeof children === 'object') {
            //具名插槽
            vnode.shapeFlag |= 16 /* ShapeFlags.SLOTS_CHILDREN */;
        }
    }
    return vnode;
}
// 用于根据 VNode 的 type property 设置 shapeFlag 对应的位
function getShapeFlag(type) {
    return typeof type === 'string'
        ? 1 /* ShapeFlags.ELEMENT */
        : 2 /* ShapeFlags.STATEFUL_COMPONENT */;
}

/* h.ts */
// 用于调用 createVNode 返回一个 VNode
function h(type, props, children) {
    return createVNode(type, props, children);
}

const extend = Object.assign;
const isObject = (val) => val !== null && typeof val === 'object';
// compare whether a value has changed, accounting for NaN.
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
// 用于判断对象中是否有某个 property
const hasOwn = (val, key) => Object.prototype.hasOwnProperty.call(val, key);
// 用于将带连字符的字符串转换为驼峰式
const camelize = (str) => {
    return str.replace(/-(\w)/g, (_, c) => {
        return c ? c.toUpperCase() : '';
    });
};
// 用于将字符串首字母转换为大写
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
// 用于在字符串之前加上 on
const toHandlerKey = (str) => {
    return str ? 'on' + capitalize(str) : '';
};

/* helpers/renderSlots.ts */
// 用于利用 div 对插槽进行包裹
function renderSlots(slots, name = 'default', props) {
    // 通过 name 获取创建相应插槽的方法
    const slot = slots[name];
    if (slot) {
        if (typeof slot === 'function') {
            // 将创建插槽方法的执行结果作为 children 传入
            return createVNode(Fragment, {}, slot(props));
        }
        else if (isObject(slot)) {
            // 具名插槽
            return createVNode(Fragment, {}, slot);
        }
    }
}

// 用于保存正在执行的 ReactiveEffect 类的实例
let activeEffect;
// 用于记录是否应该收集依赖，防止调用 stop 后触发响应式对象的 property 的 get 时收集依赖
let shouldTrack = false;
// 抽离出一个 ReactiveEffect 类，对相关操作进行封装
class ReactiveEffect {
    constructor(fn, scheduler) {
        this.scheduler = scheduler;
        // 用于保存与当前实例相关的响应式对象的 property 对应的 Set 实例
        this.deps = [];
        // 用于记录当前实例状态，为 true 时未调用 stop 方法，否则已调用，防止重复调用 stop 方法
        this.active = true;
        // 内嵌时上一个的activeEffect
        this.parent = undefined;
        // 防止内部调用 无法stop该副作用
        this.deferStop = false;
        // 将传入的函数赋值给实例的私有 property _fn
        this._fn = fn;
    }
    // 执行传入的函数
    run() {
        // 若已调用 stop 方法则直接返回传入的函数执行的结果
        if (!this.active) {
            return this._fn();
        }
        // 当前保存完的副作用函数
        let parent = activeEffect;
        // 防止内嵌产生导致外层依赖无法收集
        let lastShouldTrack = shouldTrack;
        while (parent) {
            // 处理 内层触发外层的副作用函数 setter导致 外层依赖值一直改变造成爆栈
            if (parent === this) {
                return;
            }
            parent = parent.parent;
        }
        // debugger;
        try {
            // 存储上一个存在的activeEffect（内嵌时）
            this.parent = activeEffect;
            // 应该收集依赖
            shouldTrack = true;
            // 调用 run 方法时，用全局变量 activeEffect 保存当前实例
            activeEffect = this;
            // 执行前清除依赖
            cleanupEffect(this);
            //执行副作用函数 触发收集依赖
            const res = this._fn();
            // 返回传入的函数执行的结果
            return res;
        }
        finally {
            // 执行完当前副作用函数后 储存当前的实例为上一个副作用函数
            activeEffect = this.parent;
            // 重置
            shouldTrack = lastShouldTrack;
            this.parent = undefined;
            // 防止内部调用stop后 再收集依赖 effect.deps更新了 最后副作用函数完成时依赖未完全清除时 导致清除无效
            if (this.deferStop) {
                this.stop();
            }
        }
    }
    // 用于停止传入的函数的执行
    stop() {
        // 判断此时是内部调用
        if (activeEffect == this) {
            this.deferStop = true;
        }
        else if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
// 接受一个函数作为参数
function effect(fn, options = {}) {
    // 利用传入的函数创建 ReactiveEffect 类的实例
    const _effect = new ReactiveEffect(fn);
    // 将第二个参数即 options 对象的属性和方法挂载到 ReactiveEffect 类的实例上
    extend(_effect, options);
    // 调用 ReactiveEffect 实例的 run 方法，执行传入的函数
    if (!options || !options.lazy) {
        _effect.run();
    }
    // 用一个变量 runner 保存将 _effect.run 的 this 指向指定为 _effect 的结果
    const runner = _effect.run.bind(_effect);
    // 将 _effect 赋值给 runner 的 effect property
    runner.effect = _effect;
    // 返回 runner
    return runner;
}
/**
 * 用于保存程序运行中的所有依赖
 * key 为响应式对象
 * value 为 Map 的实例，用于保存该响应式对象的所有依赖
 */
const targetsMap = new WeakMap();
// 用于收集依赖
function track(target, key) {
    // 获取当前响应式对象对应的 Map 实例,若为 undefined 则进行初始化并保存到 targetsMap 中
    /**
     * 用于保存当前响应式对象的所有依赖
     * key 为响应式对象的 property
     * value 为 Set 的实例，用于保存与该 property 相关的 ReactiveEffect 类的实例
     */
    // 若不应该收集依赖则直接返回 用于判断是否应该收集依赖
    if (!(shouldTrack && activeEffect)) {
        return;
    }
    let depsMap = targetsMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetsMap.set(target, depsMap);
    }
    // 获取当前 property 对应的 Set 实例，若为 undefined 则进行初始化并保存到 depsMap 中
    /**
     * 用于保存与当前 property 相关的函数
     * value 为与该 property 相关的 ReactiveEffect 类的实例
     */
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep);
    }
    trackEffects(dep);
}
// 用于将当前正在执行的 ReactiveEffect 类的实例添加到 dep 中， 同时将 dep 添加到当前正在执行的 ReactiveEffect 类的实例的 deps property 中
function trackEffects(dep) {
    // 若 dep 中包括当前正在执行的 ReactiveEffect 类的实例则直接返回
    if (dep.has(activeEffect)) {
        return;
    }
    // 将当前正在执行的 ReactiveEffect 类的实例添加到 dep 中
    dep.add(activeEffect);
    // 将 dep 添加到当前正在执行的 ReactiveEffect 类的实例的 deps property 中
    activeEffect.deps.push(dep);
}
// 用于触发依赖
function trigger(target, key) {
    // debugger;
    // 获取当前响应式对象对应的 Map 实例
    const depsMap = targetsMap === null || targetsMap === void 0 ? void 0 : targetsMap.get(target);
    // 获取当前 property 对应的 Set 实例
    const dep = depsMap === null || depsMap === void 0 ? void 0 : depsMap.get(key);
    if (!depsMap || !dep) {
        return;
    }
    /**
     * 遍历 dep，判断每一个 ReactiveEffect 类的实例的 scheduler property 是否存在
     * 若不为 undefined 则调用 scheduler 方法，否则调用 run 方法
     */
    triggerEffects(dep);
}
// 用于遍历 dep，调用每一个 ReactiveEffect 类的实例的 scheduler 方法或 run 方法
function triggerEffects(dep) {
    // 执行副作用函数Set时 正分支切换删除对应依赖
    let effects = new Set(dep);
    for (const reactiveEffect of effects) {
        /*    触发的依赖函数不等于当前执正在行的副作用函数 防止死循环 */
        if (reactiveEffect !== activeEffect) {
            if (reactiveEffect.scheduler) {
                reactiveEffect.scheduler();
            }
            else {
                reactiveEffect.run();
            }
        }
    }
}
// 用于将传入的 ReactiveEffect 类的实例从与该实例相关的响应式对象的 property 对应的 Set 实例中删除
function cleanupEffect(effect) {
    // 获取与该effect有关的被观察者的effect集合
    // 从前面可知，该effect关联的监控对象指向的dep是在同一个存储地址
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            //deps[i].delete操作切除了被观察与effect的联系，deps.length=0，操作切除了effect与被观察的联系。
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
// 用于停止传入的函数的执行
function stop(runner) {
    // 调用 runner 的 effect property 的 stop 方法
    runner.effect.stop();
}

// 对 get 和 set 进行缓存，防止重复调用工具函数
const get = createGetter();
const set = createSetter();
// 只读的get
const readonlyGet = createGetter(true);
const shallowGet = createGetter(false, true);
const shallowReadonlyGet = createGetter(true, true);
// 用于生成 get 函数的工具函数
function createGetter(isReadonly = false, shallow = false) {
    return function (target, key, receiver) {
        //  ReactiveFlags 是在reactive中声明的枚举值，如果key是枚举值则直接返回对应的布尔值
        if (key === "__v_isReactive" /* ReactiveFlags.IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly" /* ReactiveFlags.IS_READONLY */) {
            return isReadonly;
        }
        else if (key === "__v_isShallow" /* ReactiveFlags.IS_SHALLOW */) {
            return shallow;
        }
        else if (
        // 如果key是raw  receiver 指向调用者，则直接返回目标对象。
        // 这里判断是为了保证触发拦截 handle 的是 proxy 本身而不是 proxy 的继承者
        // 触发拦的两种方式：一是访问 proxy 对象本身的属性，二是访问对象原型链上有 proxy 对象的对象的属性，因为查询会沿着原型链向下找
        key === "__v_raw" /* ReactiveFlags.RAW */ &&
            receiver ===
                (isReadonly
                    ? shallow
                        ? shallowReadonlyMap
                        : readonlyMap
                    : shallow
                        ? shallowReactiveMap
                        : reactiveMap).get(target)) {
            return target;
        }
        const res = Reflect.get(target, key, receiver);
        // 利用 reactive 进行响应式转换时才进行依赖收集
        if (!isReadonly) {
            // 收集依赖
            track(target, key);
        }
        if (shallow) {
            return res;
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
        let oldValue = target[key];
        const res = Reflect.set(target, key, value, receiver);
        // 触发依赖
        if (hasChanged(oldValue, value)) {
            trigger(target, key);
        }
        return res;
    };
}
// reactive 对应的 handlers
const mutableHandlers = {
    get,
    set
};
// readonly 对应的 handlers
const readonlyHandlers = {
    get: readonlyGet,
    set(target, key) {
        // 调用 console.warn 发出警告
        console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
        return true;
    }
};
// shallowRreactive 对应的 handlers 是由 mutableHandlers 替换 get property 得到的
const shallowHandlers = extend({}, mutableHandlers, {
    get: shallowGet
});
// shallowReadonly 对应的 handlers 是由 readonlyHandlers 替换 get property 得到的
const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
});

const reactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
const shallowReactiveMap = new WeakMap();
const shallowReadonlyMap = new WeakMap();
function reactive(target) {
    // 如果目标对象是一个只读的响应数据,则直接返回目标对象
    if (target && target["__v_isReadonly" /* ReactiveFlags.IS_READONLY */]) {
        return target;
    }
    return createReactiveObject(target, false, mutableHandlers, reactiveMap);
}
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyMap);
}
function shallowReactive(target) {
    return createReactiveObject(target, false, shallowHandlers, shallowReactiveMap);
}
function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyMap);
}
// 用于创建 Proxy 实例的工具函数
function createReactiveObject(target, isReadonly, baseHandlers, proxyMap) {
    if (!isObject(target)) {
        // 不是对象直接返回
        return target;
    }
    // 如果传入的已经是代理了 并且 不是readonly 转换 reactive的直接返回
    if (target["__v_raw" /* ReactiveFlags.RAW */] &&
        !(isReadonly && target["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */])) {
        return target;
    }
    // 查看当前代理对象之前是不是创建过当前代理，如果创建过直接返回之前缓存的代理对象
    // proxyMap 是一个全局的缓存WeakMap
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    // 返回 Proxy 的实例
    const proxy = new Proxy(target, baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}
function isReactive(target) {
    if (isReadonly(target)) {
        return isReactive(target["__v_raw" /* ReactiveFlags.RAW */]);
    }
    return !!(target && target["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */]);
}
function isReadonly(value) {
    return !!(value && value["__v_isReadonly" /* ReactiveFlags.IS_READONLY */]);
}
function isShallow(value) {
    return !!(value && value["__v_isShallow" /* ReactiveFlags.IS_SHALLOW */]);
}
// 用于检查对象是否是由 reactive 或 readonly 创建的响应式对象
function isProxy(value) {
    // 利用 isReactive 和 isReadonly 进行判断
    return isReactive(value) || isReadonly(value);
}
function toRaw(observed) {
    const raw = observed && observed["__v_raw" /* ReactiveFlags.RAW */];
    return raw ? toRaw(raw) : observed;
}

const createDep = (effects) => {
    const dep = new Set(effects);
    return dep;
};

function trackRefValue(ref) {
    if (shouldTrack && activeEffect) {
        ref = toRaw(ref);
        trackEffects(ref.dep || (ref.dep = createDep()));
    }
}
function triggerRefValue(ref, newVal) {
    ref = toRaw(ref);
    if (ref.dep) {
        triggerEffects(ref.dep);
    }
}
// Ref 接口的实现类，对操作进行封装
class RefImpl {
    constructor(value, __v_isShallow) {
        this.__v_isShallow = __v_isShallow;
        // 用于保存与当前 ref 对象相关的依赖
        this.dep = undefined;
        // 用于标志实例是一个 ref 对象
        this.__v_isRef = true;
        // 将传入的值赋值给实例的私有 property _rawValue
        this._rawValue = __v_isShallow ? value : toRaw(value);
        // 对传入的值进行处理，将结果赋值给实例的私有 property _value
        this._value = __v_isShallow ? value : toReactive(value);
        this.dep = new Set();
    }
    get value() {
        // 收集依赖
        trackRefValue(this);
        return this._value;
    }
    set value(newVal) {
        newVal = this.__v_isShallow ? newVal : toRaw(newVal);
        // 若 set 的值与之前不同则修改并触发依赖
        if (hasChanged(newVal, this._rawValue)) {
            // 将 set 的值赋值给实例的私有 property _rawValue
            this._rawValue = newVal;
            // 对 set 的值进行处理，将结果赋值给实例的私有 property _value
            this._value = this.__v_isShallow ? newVal : toReactive(newVal);
            // 触发依赖
            triggerRefValue(this);
        }
    }
}
function createRef(rawValue, shallow) {
    if (isRef(rawValue)) {
        return rawValue;
    }
    return new RefImpl(rawValue, shallow);
}
function ref(value) {
    // 返回 RefImpl 类的实例，即 ref 对象
    return createRef(value, false);
}
// 浅代理
function shallowRef(value) {
    return createRef(value, true);
}
// 用于对值进行处理，若为对象则利用 reactive 进行响应式处理，否则直接返回
const toReactive = value => (isObject(value) ? reactive(value) : value);
// 用于判断一个值是否是 ref 对象
function isRef(r) {
    return !!(r && r.__v_isRef === true);
}
// 用于获取 ref 对象的 value property 的值
function unref(ref) {
    return isRef(ref) ? ref.value : ref;
}
/*
proxyRefs函数接受一个对象作为参数，返回一个对该对象的 get 和 set 进行代理的 Proxy 的实例proxy，
若该对象的某个 property 的值是一个 ref 对象，则可直接通过获取proxy的相应 property 的值获取该 ref 对象的传入的值，
直接修改proxy的相应 property 的值修改该 ref 对象的传入的值或替换该 ref 对象。
*/
function proxyRefs(objectWithRefs) {
    // 返回 Proxy 的实例
    return new Proxy(objectWithRefs, {
        // 对传入的对象的 property 的 get 和 set 进行代理
        get: function (target, key) {
            // 获取传入的对象的 property 的值，再调用 unref 进行处理
            return unref(Reflect.get(target, key));
        },
        set: function (target, key, value) {
            const oldValue = target[key];
            // 若传入的对象的 property 的值是一个 ref 对象，而 set 的值不是一个 ref 对象，则修改该 ref 对象的值，否则直接修改 property 的值
            if (isRef(oldValue) && !isRef(value)) {
                oldValue.value = value;
                return true;
            }
            else {
                return Reflect.set(target, key, value);
            }
        }
    });
}

/* componentEmit.ts */
// 用于调用 props 对象中的指定方法
function emit(instance, event, ...args) {
    // 通过解构赋值获取组件实例对象的 props property
    const { props } = instance;
    const handlerName = toHandlerKey(camelize(event));
    const handler = props[handlerName];
    handler && handler(...args);
}

/* componentProps.ts */
// 用于将 props 对象挂载到组件实例对象上
function initProps(instance, rawProps) {
    instance.props = rawProps || {};
}

/* componentPublicInstance.ts */
// 用于保存组件实例对象 property 及对应的 getter
const publicPropertiesMap = {
    $el: i => i.vnode.el,
    $slots: i => i.slots
};
// 组件实例对象 proxy property 对应的 handlers
const PublicInstanceHandlers = {
    get({ _: instance }, key) {
        // 通过解构赋值获取组件实例对象的 setupState property 和 props property
        const { setupState, props } = instance;
        // 若 setupState property 或 props property 上有该 property 则返回其值
        if (hasOwn(setupState, key)) {
            return setupState[key];
        }
        else if (hasOwn(props, key)) {
            return props[key];
        }
        // 若获取指定 property 则调用对应 getter 并返回其返回值
        const publicGetter = publicPropertiesMap[key];
        if (publicGetter) {
            return publicGetter(instance);
        }
    }
};

/* componentSlots.ts */
// 用于将 children 赋值给组件实例对象的 slots property
function initSlots(instance, children) {
    // 通过解构赋值获得组件对应的 VNode
    const { vnode } = instance;
    // 若 children 是插槽则进行处理
    if (typeof children === 'string' || Array.isArray(children)) {
        //默认插槽且为字符串
        instance.slots['default'] = normalizeSlotValue(children);
    }
    else if (vnode.shapeFlag & 16 /* ShapeFlags.SLOTS_CHILDREN */) {
        //具名插槽
        normalizeObjectSlots(children, instance.slots);
    }
}
// 用于遍历 children，将创建插槽对应的 VNode 数组的函数挂载到组件实例对象的 slots property 上
function normalizeObjectSlots(children, slots) {
    if (isObject(children)) {
        for (const key in children) {
            const value = children[key];
            slots[key] =
                typeof value === 'function'
                    ? props => normalizeSlotValue(value(props))
                    : normalizeSlotValue(value);
        }
    }
}
// 用于将一个 VNode 转为数组
function normalizeSlotValue(value) {
    return Array.isArray(value) ? value : [value];
}

/* component.ts */
// 用于保存当前组件实例对象
let currentInstance = null;
// 用于获取当前组件的实例对象
function getCurrentInstance() {
    return currentInstance;
}
// 用于给全局变量 currentInstance 赋值
function setCurrentInstance(instance) {
    currentInstance = instance;
}
// 用于创建组件实例对象
function createComponentInstance(vnode, parent) {
    const component = {
        vnode,
        type: vnode.type,
        setupState: {},
        props: {},
        slots: {},
        // 若存在父组件则赋值为 父组件实例对象的 provides property，否则为空对象
        provides: parent ? parent.provides : {},
        parent,
        proxy: null,
        isMounted: false,
        emit: () => { }
    };
    // 通过 Function.prototype.bind() 将 emit 函数第一个参数指定为组件实例对象，将新函数挂载到组件实例对象上
    component.emit = emit.bind(null, component);
    return component;
}
// 用于初始化 props、初始化 slots 和调用 setup 以及设置 render 函数
function setupComponent(instance) {
    // 将组件对应 VNode 的 props property 挂载到组件实例对象上
    initProps(instance, instance.vnode.props);
    // 将 children 挂载到组件实例对象的 slots property 上
    initSlots(instance, instance.vnode.children);
    setupStatefulComponent(instance);
}
// 用于初始化有状态的组件（相对的是没有状态的函数式组件）
function setupStatefulComponent(instance) {
    // 通过组件实例对象的 type property 获取组件选项对象
    const Component = instance.type;
    // 利用 Proxy 对组件实例对象的 proxy property 的 get 进行代理
    instance.proxy = new Proxy({ _: instance }, PublicInstanceHandlers);
    // 通过解构赋值获取组件选项对象中的 setup
    const { setup } = Component;
    let setupResult = {};
    if (setup) {
        // 将全局变量 currentInstance 赋值为当前组件实例对象
        setCurrentInstance(instance);
        // 调用 setup 传入 props 对象的 shallowReactive 响应式副本和包含 emit 方法的对象并获取其返回值
        setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit
        });
        // 将全局变量 currentInstance 赋值为 null
        setCurrentInstance(null);
    }
    // 处理 setup 的返回值
    handleSetupResult(instance, setupResult);
}
// 用于处理 setup 的返回值
function handleSetupResult(instance, setupResult) {
    // 根据 setup 返回值类型的不同进行不同的处理
    // 若返回一个对象则调用 proxyRefs 并传入该对象，将返回值赋值给组件实例对象的 setupState property
    if (typeof setupResult === 'object') {
        instance.setupState = proxyRefs(setupResult);
    }
    finishComponentSetup(instance);
}
// 用于设置 render 函数
function finishComponentSetup(instance) {
    // 通过组件实例对象的 type property 获取组件选项对象
    const Component = instance.type;
    // 将组件选项对象中的 render 函数挂载到组件实例对象上
    if (Component.render) {
        instance.render = Component.render;
    }
}

/* apiInject.ts */
// 用于注入依赖
function provide(key, value) {
    // 获取当前组件实例对象
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        // 通过解构赋值获取当前组件实例对象的 provides property
        let { provides } = currentInstance;
        // 获取父组件实例对象的 provides property
        const parentProvides = currentInstance.parent.provides;
        // 若判断当前组件实例对象和父组件实例对象的 provides property 相等，则是在当前组件 setup 中第一次调用 provide 函数
        if (provides === parentProvides) {
            // 利用 Object.create() 创建一个以父组件实例对象的 provides property 为原型的空对象，将其赋值给当前组件实例对象的 provides property
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        // 将依赖挂载到当前组件实例对象的 provides property 上
        provides[key] = value;
    }
}
// 用于引入依赖
function inject(key, defaultValue) {
    // 获取当前组件实例对象
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        // 获取父组件实例对象的 parent property
        const parentProvides = currentInstance.parent.provides;
        // 若父组件实例对象的 provides property 上有相应的 property 则直接返回
        if (key in parentProvides) {
            return parentProvides[key];
        }
        else if (defaultValue) {
            // 否则，若传入了默认值或默认值函数则返回默认值或默认值函数的返回值
            if (typeof defaultValue === 'function') {
                return defaultValue();
            }
            return defaultValue;
        }
    }
}

// import { render } from './renderer'
// 用于返回 createApp
function createAppAPI(render) {
    return function createApp(rootComponent) {
        const app = {
            component() { },
            directive() { },
            use() { },
            // 用于将应用挂载到根容器中
            mount(rootContainer) {
                // 将根组件转换为 VNode
                const vnode = createVNode(rootComponent);
                render(vnode, rootContainer);
                return app;
            }
        };
        return app;
    };
}

/* renderer.ts */
function createRenderer(options) {
    // 通过解构赋值获取 createText 函数、createElement 函数、patchProp 函数和 insert 函数
    const { createText: hostCreateText, createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert } = options;
    // 用于处理 VNode
    function render(vnode, container) {
        patch(null, vnode, container, null);
    }
    // 用于处理组件对应的 VNode
    function patch(n1, n2, container, parentComponent) {
        // 根据 VNode 类型的不同调用不同的函数
        // 通过 VNode 的 shapeFlag property 与枚举变量 ShapeFlags 进行与运算来判断 VNode 类型
        const { type, shapeFlag } = n2;
        // 通过 VNode 的 type property 判断 VNode 类型是 Fragment 或其他
        switch (type) {
            case Fragment:
                processFragment(n1, n2, container, parentComponent);
                break;
            case Text:
                processText(n1, n2, container);
                break;
            default:
                // 通过 VNode 的 shapeFlag property 与枚举变量 ShapeFlags 进行与运算来判断 VNode 类型是 Element 或 Component
                if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container, parentComponent);
                }
                else if (shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container, parentComponent);
                }
                break;
        }
    }
    // 用于处理 Text
    function processText(n1, n2, container) {
        // 通过解构赋值获取 Text 对应 VNode 的 children，即文本内容
        const { children } = n2;
        // createText 函数 --- 利用 document.createTextNode() 创建文本节点
        const textNode = hostCreateText(children);
        // insert 函数 利用 Element.append() 将该节点添加到根容器/其父元素中
        hostInsert(textNode, container);
    }
    // 用于处理 Fragment
    function processFragment(n1, n2, container, parentComponent) {
        mountChildren(n2.children, container, parentComponent);
    }
    // 用于处理 Element
    function processElement(n1, n2, container, parentComponent) {
        // 若旧 VNode 不存在则初始化 Element
        if (!n1) {
            mountElement(n2, container, parentComponent);
        }
        // 否则更新 Element
        else {
            //  更新 Element
            patchElement(n1, n2);
        }
    }
    // 用于更新 Element
    function patchElement(n1, n2, container) {
        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        // 获取旧 VNode 的 el property 并将其挂载到新 VNode 上
        const el = (n2.el = n1.el);
        patchProps(el, oldProps, newProps);
    }
    // 用于更新 Element 的 props
    function patchProps(el, oldProps, newProps) {
        if (oldProps !== newProps) {
            // 遍历新 VNode 的 props 对象
            for (const key in newProps) {
                const prev = oldProps[key];
                const next = newProps[key];
                // 若新旧 VNode 的 props 对象中的 property 或方法不相等
                if (prev !== next) {
                    // 将新 VNode 的 property 或方法挂载到元素上
                    hostPatchProp(el, key, next);
                }
            }
            // 遍历旧 VNode 的 props 对象
            for (const key in oldProps) {
                // 若新 VNode 的 props 对象中不包含该 property 或方法
                if (!(key in newProps)) {
                    // 将元素上该 property 或方法赋值为 null
                    hostPatchProp(el, key, null);
                }
            }
        }
    }
    // 用于初始化 Element
    function mountElement(vnode, container, parentComponent) {
        // 根据 Element 对应 VNode 的 type property 创建 DOM 元素并挂载到 VNode 上 (利用document.createElement创建)
        const el = (vnode.el = hostCreateElement(vnode.type));
        // 通过解构赋值获取 Element 对应 VNode 的 props 对象、shapeFlag property 和 children
        const { props, shapeFlag, children } = vnode;
        // 遍历 props 对象，利用 Element.setAttribute() 将其中的 property 挂载到新元素上
        // 其中 key 作为新元素的 attribute 或 property 名，value 作为 attribute 或 property 的值
        for (const key in props) {
            const val = props[key];
            // patchProp 函数
            hostPatchProp(el, key, val);
        }
        // 通过 VNode 的 shapeFlag property 与枚举变量 ShapeFlags 进行与运算来判断 children 类型
        if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            el.textContent = children;
        }
        else if (shapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
            mountChildren(children, el, parentComponent);
        }
        // insert 函数 利用 Element.append() 将新元素添加到根容器/其父元素中
        hostInsert(el, container);
    }
    // 用于遍历 children，对其中每个 VNode 调用 patch 方法进行处理
    function mountChildren(children, container, parentComponent) {
        children.forEach(child => {
            let vnode = typeof child === 'string' ? createTextVNode(child) : child;
            patch(null, vnode, container, parentComponent);
        });
    }
    // 用于处理 Component
    function processComponent(n1, n2, container, parentComponent) {
        mountComponent(n2, container, parentComponent);
    }
    // 用于初始化 Component
    function mountComponent(vnode, container, parentComponent) {
        // 通过组件对应的 VNode 创建组件实例对象，用于挂载 props、slots 等
        const instance = createComponentInstance(vnode, parentComponent);
        setupComponent(instance);
        setupRenderEffect(instance, vnode, container);
    }
    // 用于处理 VNode 树
    function setupRenderEffect(instance, vnode, container) {
        // 利用 effect 将调用 render 函数和 patch 方法的操作收集
        effect(() => {
            // 根据组件实例对象的 isMounted property 判断是初始化或更新 VNode 树
            // 若为 false 则是初始化
            if (!instance.isMounted) {
                const { proxy } = instance;
                const subTree = (instance.subTree = instance.render.call(proxy));
                patch(null, subTree, container, instance);
                vnode.el = subTree.el;
                // 将组件实例对象的 isMounted property 赋值为 true
                instance.isMounted = true;
            }
            // 否则是更新
            else {
                //  更新 VNode 树
                // 通过解构赋值获取组件实例对象的 proxy property 和旧 VNode 树
                const { proxy, subTree: preSubTree } = instance;
                // 调用组件实例对象中 render 函数获取新 VNode 树，同时将 this 指向指定为 proxy property，并将其挂载到组件实例对象上
                const subTree = (instance.subTree = instance.render.call(proxy));
                // 调用 patch 方法处理新旧 VNode 树
                patch(preSubTree, subTree, container, instance);
            }
        });
    }
    return {
        createApp: createAppAPI(render)
    };
}

exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.effect = effect;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.isProxy = isProxy;
exports.isReactive = isReactive;
exports.isReadonly = isReadonly;
exports.isRef = isRef;
exports.isShallow = isShallow;
exports.provide = provide;
exports.proxyRefs = proxyRefs;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.renderSlots = renderSlots;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
exports.shallowRef = shallowRef;
exports.stop = stop;
exports.toRaw = toRaw;
exports.unref = unref;
