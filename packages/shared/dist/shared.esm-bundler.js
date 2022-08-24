const extend = Object.assign;
const isObject = (val) => val !== null && typeof val === 'object';
// compare whether a value has changed, accounting for NaN.
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
const isFunction = (val) => typeof val === 'function';
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

export { camelize, capitalize, extend, hasChanged, hasOwn, isFunction, isObject, toHandlerKey };
