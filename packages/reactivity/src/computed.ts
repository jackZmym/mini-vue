import { ReactiveEffect } from './effect'
import { isFunction } from '@mini-zsm-vue/shared'
import { ReactiveFlags, toRaw } from './reactive'
import { triggerRefValue, trackRefValue } from './ref'
import { Dep } from './dep'
// Ref 接口的实现类
class ComputedImpl<T> {
  // 引用了当前computed的effect的Set
  public dep?: Dep = undefined
  // 放置effect对象
  private effect
  // 放置缓存值
  private _value
  // 当前值是否是脏数据，（当前值需要更新）
  private _dirty = true
  // 判断computed实例是否为只读类型
  public readonly [ReactiveFlags.IS_READONLY]: boolean = false
  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean
  ) {
    // 创建effect对象，将当前getter当做监听函数，并附加调度器
    this.effect = new ReactiveEffect(getter, () => {
      // 如果当前不是脏数据 懒触发没有读取value不会触发
      if (!this._dirty) {
        // 当前为脏数据
        this._dirty = true
        // 触发更改
        triggerRefValue(this)
      }
    })
    // 根据传入是否有setter函数来决定是否只读
    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  // value property 的 get 返回调用私有 property _effect 的 run 方法的返回值，即调用 getter 函数的返回值
  get value() {
    // computed可能被其他proxy包裹，如readonly(computed(() => foo.bar))，所以要获取this的原始对象
    const self = toRaw(this)
    // 收集依赖
    trackRefValue(self)
    if (self._dirty) {
      // 调用 ReactiveEffect 类的实例的 run 方法，即执行 getter 函数，将结果赋值给 _value property
      // 执行收集函数，更新缓存
      self._value = self.effect.run()
      // 更改为不是脏数据
      self._dirty = false
    }
    // 如果不是脏数据则直接获取缓存值
    return self._value
  }
  set value(newValue) {
    this._setter(newValue)
  }
}
export type ComputedGetter<T> = (...args: any[]) => T
export type ComputedSetter<T> = (v: T) => void
export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    getter = getterOrOptions
    setter = () => {
      console.warn('computed is readonly')
    }
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  // 返回 RefImpl 类的实例，即 ref 对象
  return new ComputedImpl(getter, setter, onlyGetter)
}
