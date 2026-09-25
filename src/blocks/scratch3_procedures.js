class Scratch3ProcedureBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * PineEditor：递归深度护栏。防止失控递归（如“恒常调用自身”或指数级递归）
     * 无限膨胀线程栈，造成浏览器假死——类似 C++ 的栈溢出保护。
     * 超过 threshold 时终结该线程并给出一次警告。
     * @param {object} util 积木执行工具。
     * @return {boolean} 是否应放弃本次调用（true = 触发护栏）。
     */
    _guardRecursion (util) {
        const threshold = this.runtime.runtimeOptions.maxProcedureDepth || 3000;
        if (util.thread.stack.length <= threshold) return false;
        const Thread = require('../engine/thread');
        util.thread.status = Thread.STATUS_DONE;
        if (this.runtime.emit) {
            this.runtime.emit('PROCEDURE_RECURSION_LIMIT', threshold);
        }
        return true;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            procedures_definition: this.definition,
            procedures_call: this.call,
            procedures_return: this.return,
            argument_reporter_string_number: this.argumentReporterStringNumber,
            argument_reporter_boolean: this.argumentReporterBoolean
        };
    }

    definition () {
        // No-op: execute the blocks.
    }

    call (args, util) {
        const stackFrame = util.stackFrame;
        const isReporter = !!args.mutation.return;

        if (stackFrame.executed) {
            if (isReporter) {
                const returnValue = stackFrame.returnValue;
                // This stackframe will be reused for other reporters in this block, so clean it up for them.
                // Can't use reset() because that will reset too much.
                const threadStackFrame = util.thread.peekStackFrame();
                threadStackFrame.params = null;
                delete stackFrame.returnValue;
                delete stackFrame.executed;
                return returnValue;
            }
            return;
        }

        // PineEditor：在真正入栈调用前做递归护栏，抑制失控递归导致的栈溢出。
        if (!stackFrame.executed && this._guardRecursion(util)) {
            return isReporter ? '' : void 0;
        }

        const procedureCode = args.mutation.proccode;
        const paramNamesIdsAndDefaults = util.getProcedureParamNamesIdsAndDefaults(procedureCode);

        // If null, procedure could not be found, which can happen if custom
        // block is dragged between sprites without the definition.
        // Match Scratch 2.0 behavior and noop.
        if (paramNamesIdsAndDefaults === null) {
            if (isReporter) {
                return '';
            }
            return;
        }

        const [paramNames, paramIds, paramDefaults] = paramNamesIdsAndDefaults;

        // Initialize params for the current stackFrame to {}, even if the procedure does
        // not take any arguments. This is so that `getParam` down the line does not look
        // at earlier stack frames for the values of a given parameter (#1729)
        util.initParams();
        for (let i = 0; i < paramIds.length; i++) {
            if (Object.prototype.hasOwnProperty.call(args, paramIds[i])) {
                util.pushParam(paramNames[i], args[paramIds[i]]);
            } else {
                util.pushParam(paramNames[i], paramDefaults[i]);
            }
        }

        const addonBlock = util.runtime.getAddonBlock(procedureCode);
        if (addonBlock) {
            const result = addonBlock.callback(util.thread.getAllparams(), util);
            if (util.thread.status === 1 /* STATUS_PROMISE_WAIT */) {
                // If the addon block is using STATUS_PROMISE_WAIT to force us to sleep,
                // make sure to not re-run this block when we resume.
                stackFrame.executed = true;
            }
            return result;
        }

        stackFrame.executed = true;

        if (isReporter) {
            util.thread.peekStackFrame().waitingReporter = true;
            // Default return value
            stackFrame.returnValue = '';
        }

        util.startProcedure(procedureCode);
    }

    return (args, util) {
        util.stopThisScript();
        // If used outside of a custom block, there may be no stackframe.
        if (util.thread.peekStackFrame()) {
            util.stackFrame.returnValue = args.VALUE;
        }
    }

    argumentReporterStringNumber (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // tw: support legacy block
            if (String(args.VALUE).toLowerCase() === 'last key pressed') {
                return util.ioQuery('keyboard', 'getLastKeyPressed');
            }
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }

    argumentReporterBoolean (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // tw: implement is compiled? and is bilup?
            const normalizeValue = input => {
                const lowered = String(input)
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, ' ');
                return lowered.endsWith('?') ? lowered.slice(0, -1).trim() : lowered;
            };

            const normalizedValue = normalizeValue(args.VALUE);
            if (util.target.runtime.compilerOptions.enabled && normalizedValue === 'is compiled') {
                return true;
            }
            if (normalizedValue === 'is bilup') {
                return true;
            }
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }
}

module.exports = Scratch3ProcedureBlocks;
