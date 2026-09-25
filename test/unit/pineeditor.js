const test = require('tap').test;
const CloudUtil = require('../../src/io/cloud-util');
const PerfAnalyzer = require('../../src/engine/perf-analyzer');
const Scratch3DataBlocks = require('../../src/blocks/scratch3_data');
const Scratch3ProcedureBlocks = require('../../src/blocks/scratch3_procedures');

// ---------- cloud-util ----------
test('cloud-util list encoding round-trips and keeps dimensions', t => {
    const grid = [[1, 2], [3, 4]];
    const encoded = CloudUtil.encodeList(grid);
    const decoded = CloudUtil.decodeList(encoded);
    t.same(decoded, grid);
    t.equal(CloudUtil.listDepth(grid), 2);
    t.equal(CloudUtil.listDepth([1, 2, 3]), 1);
    t.equal(CloudUtil.listDepth([]), 1);
    t.equal(CloudUtil.listDepth([[['a']]]), 3);
    t.end();
});

test('cloud-util list marker helpers', t => {
    const name = CloudUtil.makeListPayloadName('等级榜');
    t.ok(CloudUtil.isListPayloadName(name));
    t.equal(CloudUtil.stripListMarker(name), '等级榜');
    t.notOk(CloudUtil.isListPayloadName('ordinary'));
    t.same(CloudUtil.decodeList('not json'), []);
    t.end();
});

// ---------- PerfAnalyzer ----------
test('PerfAnalyzer.estimateGpu stays inside 0..100 and scales with load', t => {
    const p = new PerfAnalyzer({});
    const low = p.estimateGpu({frameMs: 1, drawables: 10});
    const high = p.estimateGpu({frameMs: 60, drawables: 800});
    t.ok(low >= 0 && low <= 100 && high >= 0 && high <= 100);
    t.ok(high > low, `high(${high}) should exceed low(${low})`);
    t.end();
});

test('PerfAnalyzer.computeComplexity scales with loops/branches and reports hot blocks', t => {
    const p = new PerfAnalyzer({});
    // 简单脚本：事件 -> 重复(10次){ 移动 } -> 如果{} (无深循环)
    const blocks = {
        start: {opcode: 'event_whenflagclicked', inputs: {}, next: 'loop', fields: {}},
        loop: {opcode: 'control_repeat', inputs: {TIMES: {block: 'times'}, SUBSTACK: {block: 'move'}}, next: 'br', fields: {}},
        times: {opcode: 'math_number', inputs: {}, fields: {NUM: ['10', null]}, next: null},
        move: {opcode: 'motion_movesteps', inputs: {}, next: null, fields: {}},
        br: {opcode: 'control_if', inputs: {CONDITION: {block: 'cond'}, SUBSTACK: {block: 'say'}}, next: null, fields: {}},
        cond: {opcode: 'operator_gt', inputs: {}, next: null, fields: {}},
        say: {opcode: 'looks_say', inputs: {}, next: null, fields: {}}
    };
    const r = p.computeComplexity(blocks, 'start');
    t.ok(r.loops >= 1, 'detects at least one loop');
    t.equal(r.branches, 1, 'detects one branch');
    // 10 次循环 => score >= 10 * 1 (if 只加权重)  ；至少应 >= 10
    t.ok(r.score >= 10, `score ${r.score} should be >= 10 for a 10-iteration loop`);
    t.ok(r.hotBlocks.length > 0, 'reports hot blocks');
    // forever 循环（无数值）应取默认迭代即产生 >10 的放大
    const forever = {
        start: {opcode: 'event_whenflagclicked', inputs: {}, next: 'loop', fields: {}},
        loop: {opcode: 'control_forever', inputs: {SUBSTACK: {block: 'move'}}, next: null, fields: {}},
        move: {opcode: 'motion_movesteps', inputs: {}, next: null, fields: {}}
    };
    const rf = p.computeComplexity(forever, 'start');
    t.ok(rf.score > 10, `forever score ${rf.score} should be >10 via default iteration`);
    t.end();
});

test('PerfAnalyzer.snapshot shape', t => {
    const p = new PerfAnalyzer({});
    const snap = p.snapshot();
    t.equal(typeof snap.gpuLoad, 'number');
    t.ok(Array.isArray(snap.topBlocks));
    t.ok('fps' in snap && 'frames' in snap);
    t.end();
});

// ---------- scratch3_data 多维/云列表 ----------
function makeTarget () {
    const list = {value: [], name: 'grid', _monitorUpToDate: false, isCloud: false};
    const cloudPushes = [];
    const util = {
        target: {
            lookupOrCreateList: (id, name) => list
        },
        thread: {updateMonitor: false},
        ioQuery: (device, method, args) => {
            if (device === 'cloud' && method === 'requestUpdateList') cloudPushes.push(args);
        }
    };
    return {list, util, cloudPushes};
}

test('scratch3_data 2D list create/get/set', t => {
    const blocks = new Scratch3DataBlocks({runtimeOptions: {}});
    const {list, util} = makeTarget();

    blocks.pineListCreate2d({LIST: {id: 'L', name: 'grid'}, ROWS: 2, COLS: 3, VALUE: 0}, util);
    t.equal(list.value.length, 2);
    t.equal(list.value[0].length, 3);
    t.equal(list.value[1][2], 0);

    blocks.pineListSet2d({LIST: {id: 'L'}, ROW: 1, COL: 1, VALUE: 'X'}, util);
    t.equal(list.value[0][0], 'X', 'set writes at 1-indexed (row1,col1)');
    t.equal(blocks.pineListGet2d({LIST: {id: 'L'}, ROW: 1, COL: 1}, util), 'X');
    t.equal(blocks.pineListGet2d({LIST: {id: 'L'}, ROW: 99, COL: 1}, util), '');
    t.equal(blocks.pineListDims({LIST: {id: 'L'}}, util), 2, 'dims detects 2D');

    // 维度：单维追加后为 1
    list.value = ['a', 'b', 'c'];
    t.equal(blocks.pineListDims({LIST: {id: 'L'}}, util), 1);
    t.end();
});

test('scratch3_data 2D resize preserves existing cells', t => {
    const blocks = new Scratch3DataBlocks({runtimeOptions: {}});
    const {list, util} = makeTarget();
    list.value = [[1, 2], [3, 4]];
    blocks.pineListResize({LIST: {id: 'L'}, ROWS: 3, COLS: 4, VALUE: 0}, util);
    t.equal(list.value[0][0], 1);
    t.equal(list.value[1][1], 4);
    t.equal(list.value[2][3], 0, 'new cells filled with seed');
    t.end();
});

test('scratch3_data path access for N dimensions', t => {
    const blocks = new Scratch3DataBlocks({runtimeOptions: {}});
    const {list, util} = makeTarget();
    list.value = [[['deep'], ['x']], ['flat']];
    t.equal(blocks.pineListGetPath({LIST: {id: 'L'}, PATH: '1,1,1'}, util), 'deep');
    blocks.pineListSetPath({LIST: {id: 'L'}, PATH: '1,2,1', VALUE: 'NEW'}, util);
    t.equal(list.value[0][1][0], 'NEW');
    t.equal(blocks.pineListDims({LIST: {id: 'L'}}, util), 3);
    t.end();
});

test('cloud list mutators push to cloud provider', t => {
    const blocks = new Scratch3DataBlocks({runtimeOptions: {}});
    const {list, util, cloudPushes} = makeTarget();
    list.isCloud = true;
    list.value = [];
    blocks.addToList({LIST: {id: 'L', name: 'grid'}, ITEM: 7}, util);
    t.equal(cloudPushes.length, 1, 'cloud list mutation pushes once');
    t.equal(cloudPushes[0][0], 'grid');
    t.equal(cloudPushes[0][1][0], 7);
    // 普通列表不应推送
    const plain = makeTarget();
    plain.list.value = [];
    blocks.addToList({LIST: {id: 'L2', name: 'local'}, ITEM: 1}, plain.util);
    t.equal(plain.cloudPushes.length, 0, 'non-cloud list does not push');
    // 关闭开关后即使 list.isCloud 也不推送
    const off = makeTarget();
    off.list.isCloud = true;
    const noCloud = new Scratch3DataBlocks({runtimeOptions: {cloudLists: false}});
    noCloud.addToList({LIST: {id: 'L', name: 'grid'}, ITEM: 1}, off.util);
    t.equal(off.cloudPushes.length, 0, 'cloud lists disabled -> no push');
    t.end();
});

// ---------- 自制积木递归护栏 ----------
test('procedure recursion guard stops runaway recursion', t => {
    const runtime = {
        runtimeOptions: {maxProcedureDepth: 50},
        emit: (name, payload) => { runtime.lastEvent = [name, payload]; }
    };
    const blocks = new Scratch3ProcedureBlocks(runtime);

    // 正常深度：不应触发
    const shallow = {stack: new Array(10).fill(null), status: 0};
    t.equal(blocks._guardRecursion({thread: shallow}), false, 'shallow stack passes');
    t.equal(shallow.status, 0);

    // 超出深度：触发并终结线程、发事件（Thread.STATUS_DONE === 4）
    const deep = {stack: new Array(500).fill(null), status: 0};
    t.equal(blocks._guardRecursion({thread: deep}), true, 'deep stack triggers guard');
    t.equal(deep.status, 4, 'STATUS_DONE(4) cancels the runaway thread');
    t.same(runtime.lastEvent[0], 'PROCEDURE_RECURSION_LIMIT');

    // 默认阈值：未配置时使用 3000
    const dflt = new Scratch3ProcedureBlocks({runtimeOptions: {}, emit: () => {}});
    t.equal(dflt._guardRecursion({thread: {stack: new Array(6000).fill(null), status: 0}}), true);
    t.end();
});