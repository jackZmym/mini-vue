// 用于将 props 对象中的 property 或方法挂载到元素上
export function patchProp(el, key, nextVal) {
  // 用于通过正则判断该 property 的 key 是否以 on 开头，是则为注册事件，否则为 attribute 或 property
  const isOn = (key: string) => /^on[A-Z]/.test(key)

  // 若为注册事件
  if (isOn(key)) {
    const event = key.slice(2).toLowerCase()
    // 利用 Element.addEventListener() 将方法挂载到元素上
    el.addEventListener(event, nextVal)
  } else {
    // 若 props 对象中的 property 为 undefined 或 null
    if (nextVal == null) {
      // 利用 Element.removeAttribute() 将该 property 从元素上移除
      el.removeAttribute(key)
    } else {
      // 否则
      // 利用 Element.setAttribute() 将该 property 添加到元素上
      // 其中 key 作为元素的 attribute 或 property 名，value 作为 attribute 或 property 的值
      el.setAttribute(key, nextVal)
    }
  }
}
