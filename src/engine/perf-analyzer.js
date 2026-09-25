/**
 * @fileoverview
 * PineEditor 性能分析器 (Performance Analyzer)
 *
 * 在 scratch-vm 原有 Profiler（记录每个积木的耗时）基础上，进一步提供三类分析：
 *
 *  1. blockTiming —— 哪些积木/opcode 最耗时（聚合 Profiler.onFrame 的事件）。
 *  2. complexity  —— 计算某段积木脚本的“算法时间复杂度”分数与热点项（静态图分析，
 *                   考虑循环、分支、嵌套、过程调用）。
 *  3. gpuUsage    —— 估算当前 GPU/渲染占用率（基于渲染器 drawable 数量 + 帧耗时，
 *                   与 60fps 预算的比值换算成 0~100）。
 *
 * 用法（通过 virtual-machine 暴露的 API）：
 *
 *   vm.enablePerformanceAnalysis(2000)   // 采样持续 2 秒
 *   const snap = vm.getPerformanceSnapshot()
 *   const cplx = vm.getBlockComplexity(blocks, startId)
 *
 * 该模块不依赖浏览器特定 API（performance.now 缺失时自动降级），因此可在 node 环境中
 * 通过单元测试验证。
 */
const Profiler = require('./profiler');

/**
 * 用于复杂度估算的默认循环迭代次数（当无法从静态代码读出确切循环次数时）。
 * forever / repeat-until 这类无上限循环取该值作为“最坏情况”的一个近似系数。
 * @const {number}
 */
const DEFAULT_LOOP_ITERATIONS = 100;

/**
 * 已知会显著影响复杂度的 opcode 特征表，用于静态打点。
 * @const {Object.<string, {iteration?: number|string, weight?: number}>}
 */
const BLOCK_COMPLEXITY_HINTS = {
    // 循环类：迭代次数优先从 args.TIMES 读取，否则用默认值
    control_repeat: {iteration: 'TIMES'},
    control_forever: {iteration: DEFAULT_LOOP_ITERATIONS},
    control_repeat_until: {iteration: DEFAULT_LOOP_ITERATIONS},
    control_while: {iteration: DEFAULT_LOOP_ITERATIONS},
    // 分支类：增加一次判定成本
    control_if: {weight: 2},
    control_if_else: {weight: 2},
    // 过程/函数调用：调用栈成本
    procedures_call: {weight: 3},
    procedures_definition: {weight: 1},
    // 重复执行自身（旧式 CALL 命名的变体）
    procedures_CALL: {weight: 3},
    // 事件循环
    event_whenbroadcastreceived: {weight: 2},
    control_start_as_clone: {weight: 2}
};

class PerfAnalyzer {
    /**
     * @param {object} runtime The virtual-machine Runtime instance.
     */
    constructor (runtime) {
        this.runtime = runtime;

        /**
         * 是否正在采样。
         * @type {boolean}
         */
        this.enabled = false;

        /**
         * 最近一次采样窗口的时长（毫秒）。
         * @type {number}
         */
        this.windowMs = 0;

        /**
         * 采样帧计数。
         * @type {number}
         */
        this.frames = 0;

        /**
         * 帧耗时累计（毫秒）。
         * @type {number}
         */
        this.frameTimeTotal = 0;

        /**
         * 帧耗时采样列表，用于计算平均/峰值。
         * @type {Array<number>}
         */
        this.frameTimes = [];

        /**
         * 峰值帧耗时（毫秒）。
         * @type {number}
         */
        this.maxFrameTime = 0;

        /**
         * 采样期间渲染器相关的 drawable 数量累计。
         * @type {number}
         */
        this.drawableTotal = 0;

        /**
         * opcode -> {calls, totalTime, selfTime, avg}
         * @type {Map<string, object>}
         */
        this.opStats = new Map();

        /**
         * 最近一次 gpu 估算结果。
         * @type {?number}
         */
        this.lastGpuLoad = null;

        /**
         * 节流：记录来自 Profiler 每个 frame 回调。
         * @type {Function}
         */
        this._onProfilerFrame = null;

        /**
         * 采样结束计时器句柄。
         * @type {?number}
         */
        this._stopTimer = null;

        /**
         * 用来支撑永不阻塞渲染回调的局部引用，性能敏感。
         * @type {boolean}
         */
        this._hasPerf = (
            typeof window === 'object' &&
            typeof window.performance === 'object' &&
            typeof window.performance.now === 'function') ||
            (typeof performance === 'object' && typeof performance.now === 'function');
    }

    /**
     * 返回现在的时间戳（ms），无 performance API 时用 Date.now 降级。
     * @return {number}
     */
    now () {
        if (this._hasPerf && typeof performance === 'object') {
            return performance.now();
        }
        return Date.now();
    }

    /**
     * 开始一段时长的采样。采样期间每个 opcode 的执行时间会被累计进 opStats。
     * @param {number} windowMs 采样时长（毫秒），默认 2000。
     */
    start (windowMs = 2000) {
        if (this.enabled || !this.runtime || !this.runtime.enableProfiling) {
            return false;
        }
        this.reset();
        this.enabled = true;
        this.windowMs = windowMs;
        this._onProfilerFrame = frame => this._aggregateFrame(frame);
        // 直接复用 scratch-vm 已有的 Profiler 事件流，避免侵入逐积木执行路径。
        this.runtime.enableProfiling(this._onProfilerFrame);
        if (typeof this.windowMs === 'number' && this.windowMs > 0 &&
            setTimeout && typeof setTimeout === 'function') {
            this._stopTimer = setTimeout(() => this.stop(), this.windowMs);
        }
        return true;
    }

    /**
     * 停止采样并返回快照（同时把采样并入内部累计）。
     * @return {object}
     */
    stop () {
        if (this.runtime && this.runtime.disableProfiling) {
            this.runtime.disableProfiling();
        }
        if (this._stopTimer) {
            clearTimeout(this._stopTimer);
            this._stopTimer = null;
        }
        this.enabled = false;
        return this.snapshot();
    }

    /**
     * 清空所有累计数据。
     */
    reset () {
        this.opStats.clear();
        this.frameTimes = [];
        this.frameTimeTotal = 0;
        this.frames = 0;
        this.maxFrameTime = 0;
        this.drawableTotal = 0;
        this.lastGpuLoad = null;
        // 使旧的 opStats 引用失效
        this._statsRef = this.opStats;
    }

    /**
     * 供运行时每帧调用：累计帧耗时与 drawable 数量，用于 GPU 估算与 FPS。
     * @param {number} frameTime 本帧 CPU 耗时（ms）。
     */
    sampleFrame (frameTime) {
        if (!this.enabled) return;
        const t = (typeof frameTime === 'number' && frameTime > 0) ? frameTime : 0;
        this.frames += 1;
        this.frameTimeTotal += t;
        this.frameTimes.push(t);
        if (t > this.maxFrameTime) this.maxFrameTime = t;

        let drawables = 0;
        const renderer = this.runtime && this.runtime.renderer;
        if (renderer) {
            if (typeof renderer.getDrawables === 'function') {
                const layer = renderer.getDrawables();
                if (layer) drawables = layer.length;
            } else if (typeof renderer._drawList === 'function') {
                try {
                    const d = renderer._drawList();
                    if (d) drawables = d.length;
                } catch (e) {
                    drawables = 0;
                }
            }
        }
        this.drawableTotal += drawables;
        this.lastGpuLoad = this.estimateGpu({frameTime: t, drawables, frameMs: t});
    }

    /**
     * 把 Profiler 汇报的单帧事件聚合进 opStats。
     * @private
     * @param {object} frame A ProfilerFrame emitted by Profiler.
     */
    _aggregateFrame (frame) {
        if (!frame || typeof frame.arg === 'undefined') return;
        // ProfilerFrame.arg 通常是 opcode；若无则用 nameById 反查。
        let opcode = frame.arg;
        if (opcode === null && frame.id >= 0 && Profiler.nameById) {
            opcode = Profiler.nameById(frame.id);
        }
        if (typeof opcode !== 'string' || opcode.length === 0) return;
        const stats = this._statsRef.get(opcode) || {calls: 0, totalTime: 0, selfTime: 0, avg: 0};
        stats.calls += (typeof frame.count === 'number' ? frame.count : 1);
        const total = (typeof frame.totalTime === 'number' ? frame.totalTime : 0) || 0;
        const self = (typeof frame.selfTime === 'number' ? frame.selfTime : 0) || 0;
        stats.totalTime += total;
        stats.selfTime += self;
        stats.avg = stats.calls > 0 ? stats.totalTime / stats.calls : 0;
        this._statsRef.set(opcode, stats);
    }

    /**
     * 估算 GPU 占用率（0~100）。
     * 依据：帧耗时相对 16.67ms（60fps）预算的比值，叠加 drawable 数量带来的负载权重。
     * @param {{frameTime?: number, drawables?: number, frameMs?: number}} options
     * @return {number}
     */
    estimateGpu (options = {}) {
        const frameMs = options.frameMs || options.frameTime || 0;
        const drawables = options.drawables || 0;
        const fpsBudget = 16.6667;
        // 基础负载来自帧耗时占预算的比例
        const load = frameMs > 0 ? Math.min(1, frameMs / fpsBudget) : 0;
        // drawable 越多，顶点/片元负载越高（近似线性，超过约 300 个 drawable 基本满载）
        const drawFactor = Math.min(1, drawables / 300);
        // time 负载权重 0.65，drawable 权重 0.35
        const gpu = (load * 0.65) + (drawFactor * 0.35);
        return Math.max(0, Math.min(100, Math.round(gpu * 100)));
    }

    /**
     * 静态计算一段积木脚本的时间复杂度分数与热点项。
     * 遍历以 startId 为入口的积木图（含并列下个积木、分支子堆、循环子堆、过程调用）。
     * @param {object} blocks Scratch 原始 blocks 对象（{id: block}）。
     * @param {string} startId 脚本的入口积木 id。
     * @return {{
     *     score: number,
     *     hotBlocks: Array<{id: string, opcode: string, weight: number}>,
     *     loops: number,
     *     branches: number,
     *     calls: number
     * }}
     */
    computeComplexity (blocks, startId) {
        const result = {
            score: 1,
            loops: 0,
            branches: 0,
            calls: 0,
            hotBlocks: []
        };
        if (!blocks || typeof blocks !== 'object' || !startId || !blocks[startId]) {
            return result;
        }
        const visited = new Set();
        const walk = (id, depth) => {
            if (!id || visited.has(id)) return;
            visited.add(id);
            const block = blocks[id];
            if (!block || !block.opcode) return;

            let hint = BLOCK_COMPLEXITY_HINTS[block.opcode];
            if (!hint && block.opcode === 'procedures_call') {
                hint = BLOCK_COMPLEXITY_HINTS.procedures_call;
            }
            if (hint) {
                if (block.opcode === 'control_if' || block.opcode === 'control_if_else') {
                    result.branches += 1;
                }
                let iterations = 1;
                if (typeof hint.iteration === 'number') {
                    iterations = hint.iteration;
                    result.loops += 1;
                    result.score *= iterations;
                    result.hotBlocks.push({id, opcode: block.opcode, weight: iterations});
                } else if (typeof hint.iteration === 'string') {
                    // 尝试静态读出循环次数
                    let n = 1;
                    if (block.inputs && block.inputs[hint.iteration] &&
                        block.inputs[hint.iteration].block) {
                        const ctx = blocks[block.inputs[hint.iteration].block];
                        if (ctx && typeof ctx.fields !== 'undefined') {
                            const f = ctx.fields;
                            const k = Object.keys(f || {})[0];
                            if (k && f[k] && !Number.isNaN(parseFloat(f[k][0]))) {
                                n = parseFloat(f[k][0]);
                            }
                        }
                    }
                    const iter = Number.isFinite(n) && n >= 1 ? Math.max(1, Math.round(n)) : DEFAULT_LOOP_ITERATIONS;
                    iterations = Math.min(iter, 1000000); // 防止极端情况下溢出
                    result.loops += 1;
                    result.score *= iterations;
                    result.hotBlocks.push({id, opcode: block.opcode, weight: iterations});
                }
                if (hint.weight) {
                    result.score += hint.weight;
                    result.hotBlocks.push({id, opcode: block.opcode, weight: hint.weight});
                }
            } else if (block.opcode === 'control_if' || block.opcode === 'control_if_else') {
                result.branches += 1;
                result.score += 2;
            }

            // 递归进入：普通输入、C 型子堆、并列下个积木
            const inputs = block.inputs || {};
            for (const key of Object.keys(inputs)) {
                const input = inputs[key];
                if (!input) continue;
                const sub = Array.isArray(input) ? input[1] : input.block;
                walk(sub, depth + 1);
            }
            if (block.next) walk(block.next, depth);
            // 旧版分支字段兼容
            if (block.fields && block.fields.SUBSTACK && block.fields.SUBSTACK[0]) {
                walk(block.fields.SUBSTACK[0], depth + 1);
            }
        };
        walk(startId, 0);
        result.score = Math.max(1, Math.round(result.score));
        // 按权重降序取前 10 个热点
        result.hotBlocks.sort((a, b) => b.weight - a.weight);
        result.hotBlocks = result.hotBlocks.slice(0, 10);
        return result;
    }

    /**
     * 生成当前采样总快照，供 UI 展示。
     * @return {object}
     */
    snapshot () {
        const opStats = new Map(this.opStats);
        const sorted = Array.from(opStats.entries())
            .sort((a, b) => (b[1].totalTime || 0) - (a[1].totalTime || 0))
            .map(([opcode, s]) => ({
                opcode,
                calls: s.calls,
                selfTime: Math.round(s.selfTime * 100) / 100,
                totalTime: Math.round(s.totalTime * 100) / 100,
                avg: Math.round(s.avg * 10000) / 10000
            }))
            .slice(0, 50);

        const avgFrame = this.frames > 0 ? this.frameTimeTotal / this.frames : 0;
        const fps = this.frames > 0 && this.frames / (this.windowMs / 1000) ?
            Math.round(this.frames / Math.max(1, this.windowMs / 1000)) : 0;
        const avgDrawables = this.frames > 0 ? Math.round(this.drawableTotal / this.frames) : 0;
        const gpuLoad = this.lastGpuLoad === null ?
            this.estimateGpu({frameMs: avgFrame, drawables: avgDrawables}) : this.lastGpuLoad;

        return {
            enabled: this.enabled,
            windowMs: this.windowMs,
            frames: this.frames,
            fps,
            avgFrameTime: Math.round(avgFrame * 100) / 100,
            maxFrameTime: Math.round(this.maxFrameTime * 100) / 100,
            gpuLoad,
            avgDrawables,
            topBlocks: sorted
        };
    }
}

module.exports = PerfAnalyzer;
