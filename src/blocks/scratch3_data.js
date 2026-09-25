const Cast = require('../util/cast');
const CloudUtil = require('../io/cloud-util');

class Scratch3DataBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * 云列表开关（默认开启）。可通过 runtime.runtimeOptions.cloudLists 覆盖。
     * @return {boolean}
     */
    cloudListsEnabled () {
        const o = this.runtime && this.runtime.runtimeOptions;
        return !o || o.cloudLists !== false;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            data_variable: this.getVariable,
            data_setvariableto: this.setVariableTo,
            data_changevariableby: this.changeVariableBy,
            data_hidevariable: this.hideVariable,
            data_showvariable: this.showVariable,
            data_listcontents: this.getListContents,
            data_addtolist: this.addToList,
            data_deleteoflist: this.deleteOfList,
            data_deletealloflist: this.deleteAllOfList,
            data_insertatlist: this.insertAtList,
            data_replaceitemoflist: this.replaceItemOfList,
            data_itemoflist: this.getItemOfList,
            data_itemnumoflist: this.getItemNumOfList,
            data_lengthoflist: this.lengthOfList,
            data_listcontainsitem: this.listContainsItem,
            data_hidelist: this.hideList,
            data_showlist: this.showList,
            data_listjson: this.listjson,
            // ---- PineEditor 多维列表与云列表扩展 ----
            pine_list_dims: this.pineListDims,
            pine_list_create2d: this.pineListCreate2d,
            pine_list_resize: this.pineListResize,
            pine_list_get2d: this.pineListGet2d,
            pine_list_set2d: this.pineListSet2d,
            pine_list_getpath: this.pineListGetPath,
            pine_list_setpath: this.pineListSetPath
        };
    }

    getVariable (args, util) {
        const variable = util.target.lookupOrCreateVariable(
            args.VARIABLE.id, args.VARIABLE.name);
        return variable.value;
    }

    setVariableTo (args, util) {
        const variable = util.target.lookupOrCreateVariable(
            args.VARIABLE.id, args.VARIABLE.name);
        variable.value = args.VALUE;

        if (variable.isCloud) {
            util.ioQuery('cloud', 'requestUpdateVariable', [variable.name, args.VALUE]);
        }
    }

    changeVariableBy (args, util) {
        const variable = util.target.lookupOrCreateVariable(
            args.VARIABLE.id, args.VARIABLE.name);
        const castedValue = Cast.toNumber(variable.value);
        const dValue = Cast.toNumber(args.VALUE);
        const newValue = castedValue + dValue;
        variable.value = newValue;

        if (variable.isCloud) {
            util.ioQuery('cloud', 'requestUpdateVariable', [variable.name, newValue]);
        }
    }

    changeMonitorVisibility (id, visible) {
        // Send the monitor blocks an event like the flyout checkbox event.
        // This both updates the monitor state and changes the isMonitored block flag.
        this.runtime.monitorBlocks.changeBlock({
            id: id, // Monitor blocks for variables are the variable ID.
            element: 'checkbox', // Mimic checkbox event from flyout.
            value: visible
        }, this.runtime);
    }

    showVariable (args) {
        this.changeMonitorVisibility(args.VARIABLE.id, true);
    }

    hideVariable (args) {
        this.changeMonitorVisibility(args.VARIABLE.id, false);
    }

    showList (args) {
        this.changeMonitorVisibility(args.LIST.id, true);
    }

    hideList (args) {
        this.changeMonitorVisibility(args.LIST.id, false);
    }

    getListContents (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);

        // If block is running for monitors, return copy of list as an array if changed.
        if (util.thread.updateMonitor) {
            // Return original list value if up-to-date, which doesn't trigger monitor update.
            if (list._monitorUpToDate) return list.value;
            // If value changed, reset the flag and return a copy to trigger monitor update.
            // MonitorState only detects updates when the object changes.
            list._monitorUpToDate = true;
            return list.value.slice();
        }

        // Determine if the list is all single letters.
        // If it is, report contents joined together with no separator.
        // If it's not, report contents joined together with a space.
        let allSingleLetters = true;
        for (let i = 0; i < list.value.length; i++) {
            const listItem = list.value[i];
            if (!((typeof listItem === 'string') &&
                  (listItem.length === 1))) {
                allSingleLetters = false;
                break;
            }
        }
        if (allSingleLetters) {
            return list.value.join('');
        }
        return list.value.join(' ');

    }

    addToList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        list.value.push(args.ITEM);
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    deleteOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length, true);
        if (index === Cast.LIST_INVALID) {
            return;
        } else if (index === Cast.LIST_ALL) {
            list.value = [];
            this._pushCloudList(list, util);
            return;
        }
        list.value.splice(index - 1, 1);
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    deleteAllOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        list.value = [];
        this._pushCloudList(list, util);
        return;
    }

    insertAtList (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length + 1, false);
        if (index === Cast.LIST_INVALID) {
            return;
        }
        list.value.splice(index - 1, 0, item);
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    replaceItemOfList (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length, false);
        if (index === Cast.LIST_INVALID) {
            return;
        }
        list.value[index - 1] = item;
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    getItemOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length, false);
        if (index === Cast.LIST_INVALID) {
            return '';
        }
        return list.value[index - 1];
    }

    getItemNumOfList (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);

        if (this.runtime && this.runtime.runtimeOptions.caseSensitiveLists) {
            return list.value.indexOf(item) + 1;
        }

        // Go through the list items one-by-one using Cast.compare. This is for
        // cases like checking if 123 is contained in a list [4, 7, '123'] --
        // Scratch considers 123 and '123' to be equal.
        for (let i = 0; i < list.value.length; i++) {
            if (Cast.compare(list.value[i], item) === 0) {
                return i + 1;
            }
        }

        // We don't bother using .indexOf() at all, because it would end up with
        // edge cases such as the index of '123' in [4, 7, 123, '123', 9].
        // If we use indexOf(), this block would return 4 instead of 3, because
        // indexOf() sees the first occurence of the string 123 as the fourth
        // item in the list. With Scratch, this would be confusing -- after all,
        // '123' and 123 look the same, so one would expect the block to say
        // that the first occurrence of '123' (or 123) to be the third item.

        // Default to 0 if there's no match. Since Scratch lists are 1-indexed,
        // we don't have to worry about this conflicting with the "this item is
        // the first value" number (in JS that is 0, but in Scratch it's 1).
        return 0;
    }

    listjson (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        return JSON.stringify(list.value);
    }

    lengthOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        return list.value.length;
    }

    listContainsItem (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        if (this.runtime && this.runtime.runtimeOptions.caseSensitiveLists) {
            return list.value.indexOf(item) !== -1;
        }
        if (list.value.indexOf(item) >= 0) {
            return true;
        }
        // Try using Scratch comparison operator on each item.
        // (Scratch considers the string '123' equal to the number 123).
        for (let i = 0; i < list.value.length; i++) {
            if (Cast.compare(list.value[i], item) === 0) {
                return true;
            }
        }
        return false;
    }

    // =====================================================================
    //  PineEditor：云列表 / 多维列表
    // =====================================================================

    /**
     * 判断一个列表是否需要同步到云端（云列表）。云列表开关关闭时永远返回 false。
     * @param {object} list 列表对象。
     * @return {boolean}
     */
    _isCloudList (list) {
        if (!this.cloudListsEnabled()) return false;
        if (list && list.isCloud) return true;
        // 以云变量命名约定（空格+☁ 前缀）创建的列表也视为云列表
        if (list && typeof list.name === 'string' && list.name.indexOf('\u2601 ') === 0) {
            return true;
        }
        return false;
    }

    /**
     * 就地构建云载荷变量并请求同步到云服务。
     * @param {object} list 列表对象。
     * @param {object} util 积木执行工具（提供 ioQuery）。
     */
    _pushCloudList (list, util) {
        if (!this._isCloudList(list) || !util || !util.ioQuery) return;
        try {
            util.ioQuery('cloud', 'requestUpdateList', [list.name, list.value]);
        } catch (e) {
            // 云不可用时不阻塞本地列表操作
        }
    }

    /**
     * 一维索引归一化（Scratch 1 起始），越界返回 null。
     * @param {number} raw 原始下标。
     * @param {number} length 维度长度。
     * @return {?number} 归一化后的 0 起始下标，或 null。
     */
    _normIndex (raw, length) {
        const n = Cast.toNumber(raw);
        if (!Number.isFinite(n)) return null;
        const idx = Math.round(n) - 1;
        if (idx < 0 || idx >= length) return null;
        return idx;
    }

    /**
     * PineEditor：返回列表维度（最深嵌套深度）。扁平列表为 1，二维为 2……
     * @param {{LIST: object}} args
     * @return {number}
     */
    pineListDims (args, util) {
        const list = util.target.lookupOrCreateList(args.LIST.id, args.LIST.name);
        return CloudUtil.listDepth(list.value);
    }

    /**
     * PineEditor：创建一个 ROWS×COLS 的二维列表，全部填 VALUE。
     * @param {{LIST: object, ROWS: number, COLS: number, VALUE: *}} args
     */
    pineListCreate2d (args, util) {
        const list = util.target.lookupOrCreateList(args.LIST.id, args.LIST.name);
        const rows = Math.max(0, Math.min(10000, Math.round(Cast.toNumber(args.ROWS) || 0)));
        const cols = Math.max(0, Math.min(10000, Math.round(Cast.toNumber(args.COLS) || 0)));
        const value = args.VALUE;
        const grid = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) row.push(value);
            grid.push(row);
        }
        list.value = grid;
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    /**
     * PineEditor：把列表重塑为 ROWS×COLS。已有元素保留，缺失位填 VALUE。
     * @param {{LIST: object, ROWS: number, COLS: number, VALUE: *}} args
     */
    pineListResize (args, util) {
        const list = util.target.lookupOrCreateList(args.LIST.id, args.LIST.name);
        const rows = Math.max(0, Math.min(10000, Math.round(Cast.toNumber(args.ROWS) || 0)));
        const cols = Math.max(0, Math.min(10000, Math.round(Cast.toNumber(args.COLS) || 0)));
        const value = args.VALUE;
        const grid = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            const existing = Array.isArray(list.value[r]) ? list.value[r] : [];
            for (let c = 0; c < cols; c++) {
                row.push(c < existing.length ? existing[c] : value);
            }
            grid.push(row);
        }
        list.value = grid;
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    /**
     * PineEditor：读取二维列表第 ROW 行第 COL 列。
     * @param {{LIST: object, ROW: number, COL: number}} args
     * @return {*}
     */
    pineListGet2d (args, util) {
        const list = util.target.lookupOrCreateList(args.LIST.id, args.LIST.name);
        if (!Array.isArray(list.value)) return '';
        const r = this._normIndex(args.ROW, list.value.length);
        if (r === null || !Array.isArray(list.value[r])) return '';
        const row = list.value[r];
        const c = this._normIndex(args.COL, row.length);
        return c === null ? '' : row[c];
    }

    /**
     * PineEditor：写入二维列表第 ROW 行第 COL 列。
     * @param {{LIST: object, ROW: number, COL: number, VALUE: *}} args
     */
    pineListSet2d (args, util) {
        const list = util.target.lookupOrCreateList(args.LIST.id, args.LIST.name);
        if (!Array.isArray(list.value)) list.value = [];
        const r = this._normIndex(args.ROW, list.value.length);
        if (r === null) return;
        if (!Array.isArray(list.value[r])) list.value[r] = [];
        const row = list.value[r];
        const c = this._normIndex(args.COL, row.length);
        if (c === null) return;
        row[c] = args.VALUE;
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    /**
     * PineEditor：用路径读取任意维度的值。PATH 用英文逗号分隔的一维下标（1 起始）。
     * @param {{LIST: object, PATH: string}} args
     * @return {*}
     */
    pineListGetPath (args, util) {
        const list = util.target.lookupOrCreateList(args.LIST.id, args.LIST.name);
        const path = this._parsePath(args.PATH, 1);
        if (!path) return '';
        let cur = list.value;
        for (let i = 0; i < path.length; i++) {
            if (!Array.isArray(cur)) return '';
            const idx = path[i];
            if (idx < 0 || idx >= cur.length) return '';
            cur = cur[idx];
        }
        return cur;
    }

    /**
     * PineEditor：用路径写入任意维度的值。PATH 用英文逗号分隔的一维下标（1 起始）。
     * @param {{LIST: object, PATH: string, VALUE: *}} args
     */
    pineListSetPath (args, util) {
        const list = util.target.lookupOrCreateList(args.LIST.id, args.LIST.name);
        const path = this._parsePath(args.PATH, 1);
        if (!path || path.length === 0) return;
        // 确保路径上的每一级都是数组
        let cur = list.value;
        if (!Array.isArray(cur)) {
            list.value = []; cur = list.value;
        }
        for (let i = 0; i < path.length - 1; i++) {
            const idx = path[i];
            if (idx < 0 || idx >= cur.length) {
                cur.length = idx + 1;
            }
            if (!Array.isArray(cur[idx])) cur[idx] = []; // eslint-disable-line no-magic-numbers
            cur = cur[idx];
        }
        const last = path[path.length - 1];
        cur[last] = args.VALUE;
        list._monitorUpToDate = false;
        this._pushCloudList(list, util);
    }

    /**
     * 把逗号分隔的字符串下标解析为整数数组（1 起始还原为 0 起始）。
     * @param {*} raw PATH 参数。
     * @param {number} base 输入基数（1 表示用户下标从 1 开始）。
     * @return {?Array<number>}
     */
    _parsePath (raw, base) {
        if (typeof raw !== 'string') return null;
        const parts = raw.split(',');
        const out = [];
        for (const p of parts) {
            const n = parseFloat(p.trim());
            if (!Number.isFinite(n)) return null;
            out.push(Math.round(n) - (base || 0));
        }
        return out;
    }
}

module.exports = Scratch3DataBlocks;
