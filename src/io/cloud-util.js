/**
 * @fileoverview
 * PineEditor 云列表 (Cloud List) 工具。
 *
 * Scratch 的老牌云数据协议只支持“标量变量”，不支持列表。PineEditor 引入云列表的方式是
 * 把列表序列化成字符串载荷，通过云变量的通道同步；客户端收到以列表标记名结尾的更新时，
 * 在本地把它还原成列表值。
 *
 * 本模块只包含与平台无关的纯函数（编解码/标记），因此可以在 node 环境中做单元测试。
 */

/**
 * 云列表变量名的后缀标记，用于把“云列表”和普通“云变量”区分开。
 * @const {string}
 */
const LIST_MARKER = '\u2764PineList';

/**
 * 判断一个云变量名是否是一个云列表的载荷名。
 * @param {string} name 云变量名。
 * @return {boolean}
 */
const isListPayloadName = name => typeof name === 'string' && name.endsWith(LIST_MARKER);

/**
 * 从云列表载荷变量名还原出列表名。
 * @param {string} name
 * @return {string}
 */
const stripListMarker = name => (isListPayloadName(name) ? name.slice(0, -LIST_MARKER.length) : name);

/**
 * 生成一个列表对应的云载荷变量名。
 * @param {string} listName 列表名。
 * @return {string}
 */
const makeListPayloadName = listName => `${listName}${LIST_MARKER}`;

/**
 * 归一化列表值：n 维列表（嵌套数组）会被编码为 JSON 数组。
 * 普通 items 可能是字符串/数字/布尔值/null/嵌套数组。
 * @param {Array} value 原始列表 value（可能含嵌套数组多维结构）。
 * @return {string} 序列化后的载荷字符串。
 */
const encodeList = value => {
    if (Array.isArray(value)) {
        return JSON.stringify(value);
    }
    return JSON.stringify([]);
};

/**
 * 从云载荷字符串还原列表。失败时返回空数组。
 * @param {string} str 云列表载荷字符串。
 * @return {Array}
 */
const decodeList = str => {
    if (typeof str !== 'string') return [];
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

/**
 * 递归计算一个列表的维度数（最深的嵌套层级）。二维列表返回 2，空/扁平列表返回 1。
 * @param {*} value
 * @return {number} >=1
 */
const listDepth = value => {
    if (!Array.isArray(value)) return 0;
    let depth = 1;
    for (let i = 0; i < value.length; i++) {
        if (Array.isArray(value[i])) {
            depth = Math.max(depth, 1 + listDepth(value[i]));
        }
    }
    return depth;
};

module.exports = {
    LIST_MARKER,
    isListPayloadName,
    stripListMarker,
    makeListPayloadName,
    encodeList,
    decodeList,
    listDepth
};
