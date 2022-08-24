var VueReactivity = (function (exports) {
  'use strict';

  const extend = Object.assign;
  const isObject = (val) => val !== null && typeof val === 'object';
  // compare whether a value has changed, accounting for NaN.
  const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
  const isFunction = (val) => typeof val === 'function';

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

  var _a;
  // Ref 接口的实现类
  class ComputedImpl {
      constructor(getter, _setter, isReadonly) {
          this._setter = _setter;
          // 引用了当前computed的effect的Set
          this.dep = undefined;
          // 当前值是否是脏数据，（当前值需要更新）
          this._dirty = true;
          // 判断computed实例是否为只读类型
          this[_a] = false;
          // 创建effect对象，将当前getter当做监听函数，并附加调度器
          this.effect = new ReactiveEffect(getter, () => {
              // 如果当前不是脏数据 懒触发没有读取value不会触发
              if (!this._dirty) {
                  // 当前为脏数据
                  this._dirty = true;
                  // 触发更改
                  triggerRefValue(this);
              }
          });
          // 根据传入是否有setter函数来决定是否只读
          this["__v_isReadonly" /* ReactiveFlags.IS_READONLY */] = isReadonly;
      }
      // value property 的 get 返回调用私有 property _effect 的 run 方法的返回值，即调用 getter 函数的返回值
      get value() {
          // computed可能被其他proxy包裹，如readonly(computed(() => foo.bar))，所以要获取this的原始对象
          const self = toRaw(this);
          // 收集依赖
          trackRefValue(self);
          if (self._dirty) {
              // 调用 ReactiveEffect 类的实例的 run 方法，即执行 getter 函数，将结果赋值给 _value property
              // 执行收集函数，更新缓存
              self._value = self.effect.run();
              // 更改为不是脏数据
              self._dirty = false;
          }
          // 如果不是脏数据则直接获取缓存值
          return self._value;
      }
      set value(newValue) {
          this._setter(newValue);
      }
  }
  _a = "__v_isReadonly" /* ReactiveFlags.IS_READONLY */;
  function computed(getterOrOptions) {
      let getter;
      let setter;
      const onlyGetter = isFunction(getterOrOptions);
      if (onlyGetter) {
          getter = getterOrOptions;
          setter = () => {
              console.warn('computed is readonly');
          };
      }
      else {
          getter = getterOrOptions.get;
          setter = getterOrOptions.set;
      }
      // 返回 RefImpl 类的实例，即 ref 对象
      return new ComputedImpl(getter, setter, onlyGetter);
  }

  exports.computed = computed;
  exports.effect = effect;
  exports.isProxy = isProxy;
  exports.isReactive = isReactive;
  exports.isReadonly = isReadonly;
  exports.isRef = isRef;
  exports.isShallow = isShallow;
  exports.proxyRefs = proxyRefs;
  exports.reactive = reactive;
  exports.readonly = readonly;
  exports.ref = ref;
  exports.shallowReactive = shallowReactive;
  exports.shallowReadonly = shallowReadonly;
  exports.shallowRef = shallowRef;
  exports.stop = stop;
  exports.toRaw = toRaw;
  exports.unref = unref;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
