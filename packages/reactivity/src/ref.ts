import {
  trackEffects,
  triggerEffects,
  shouldTrack,
  activeEffect
} from './effect'
import { isObject, hasChanged } from '@mini-vue/shared'
import { reactive, toRaw } from './reactive'
import { Dep, createDep } from './dep'
// ref 对象的接口
interface Ref<T = any> {
  value: T
}
type RefBase<T> = {
  dep?: Dep
  value: T
}
export function trackRefValue(ref: RefBase<any>) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref)
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}
export function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  ref = toRaw(ref)
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}
// Ref 接口的实现类，对操作进行封装
class RefImpl<T> {
  // 用于保存传入的值和 set 的值
  private _rawValue
  private _value
  // 用于保存与当前 ref 对象相关的依赖
  public dep?: Dep = undefined
  // 用于标志实例是一个 ref 对象
  public __v_isRef = true

  constructor(value: T, public readonly __v_isShallow: boolean) {
    // 将传入的值赋值给实例的私有 property _rawValue
    this._rawValue = __v_isShallow ? value : toRaw(value)
    // 对传入的值进行处理，将结果赋值给实例的私有 property _value
    this._value = __v_isShallow ? value : toReactive(value)
    this.dep = new Set()
  }

  get value() {
    // 收集依赖
    trackRefValue(this)
    return this._value
  }
  set value(newVal) {
    newVal = this.__v_isShallow ? newVal : toRaw(newVal)
    // 若 set 的值与之前不同则修改并触发依赖
    if (hasChanged(newVal, this._rawValue)) {
      // 将 set 的值赋值给实例的私有 property _rawValue
      this._rawValue = newVal
      // 对 set 的值进行处理，将结果赋值给实例的私有 property _value
      this._value = this.__v_isShallow ? newVal : toReactive(newVal)
      // 触发依赖
      triggerRefValue(this, newVal)
    }
  }
}
function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}
export function ref(value?: unknown) {
  // 返回 RefImpl 类的实例，即 ref 对象
  return createRef(value, false)
}
// 浅代理
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}
// 用于对值进行处理，若为对象则利用 reactive 进行响应式处理，否则直接返回
export const toReactive = value => (isObject(value) ? reactive(value) : value)

// 用于判断一个值是否是 ref 对象
export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

// 用于获取 ref 对象的 value property 的值
export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? (ref.value as any) : ref
}

/* 
proxyRefs函数接受一个对象作为参数，返回一个对该对象的 get 和 set 进行代理的 Proxy 的实例proxy，
若该对象的某个 property 的值是一个 ref 对象，则可直接通过获取proxy的相应 property 的值获取该 ref 对象的传入的值，
直接修改proxy的相应 property 的值修改该 ref 对象的传入的值或替换该 ref 对象。
*/
export function proxyRefs(objectWithRefs) {
  // 返回 Proxy 的实例
  return new Proxy(objectWithRefs, {
    // 对传入的对象的 property 的 get 和 set 进行代理
    get: function (target, key) {
      // 获取传入的对象的 property 的值，再调用 unref 进行处理
      return unref(Reflect.get(target, key))
    },
    set: function (target, key, value) {
      const oldValue = target[key]
      // 若传入的对象的 property 的值是一个 ref 对象，而 set 的值不是一个 ref 对象，则修改该 ref 对象的值，否则直接修改 property 的值
      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      } else {
        return Reflect.set(target, key, value)
      }
    }
  })
}
