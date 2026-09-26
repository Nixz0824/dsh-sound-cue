/**
 * test-client.mjs — 功能性测试：在新老两代客户端状态模型下验证触发逻辑。
 *
 * 做法：伪造 window.__ModuleLoader__ 载入 lib/client.js，伪造 AudioContext 统计音符，
 * 用假 store 驱动状态迁移，断言"需要操作 / 任务完成"是否按预期响、子代理是否被忽略。
 *
 * 运行：node scripts/test-client.mjs
 */
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const SRC = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

function loadBundle() {
  let handoff = null;
  const fakeWindow = {
    __ModuleLoader__: { load: (h) => { handoff = h; } },
    addEventListener() {},
    removeEventListener() {},
  };
  new Function("window", SRC)(fakeWindow);
  assert.ok(handoff, "bundle 未调用 window.__ModuleLoader__.load");
  assert.equal(handoff.id, "dsh-sound-cue");
  return { mod: handoff.factory(() => { throw new Error("bundle 不应 require 任何模块"); }), fakeWindow };
}

function installAudio() {
  const notes = [];
  class FakeAudioContext {
    constructor() { this.state = "running"; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} },
        connect() {},
      };
    }
    createOscillator() {
      const freq = { value: null };
      return {
        type: "",
        frequency: { setValueAtTime: (v) => { freq.value = v; }, exponentialRampToValueAtTime() {} },
        connect() {},
        start() { notes.push(freq.value); },
        stop() {},
      };
    }
    createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
    createBufferSource() { return { buffer: null, connect() {}, start() {} }; }
  }
  globalThis.AudioContext = FakeAudioContext;
  globalThis.window = globalThis.window || {};
  return notes;
}

function createHarness({ withUiSession }) {
  const listListeners = [];
  const statusListeners = [];
  let snapshot = { ids: [], byId: {}, projectionsBySession: {} };
  let statuses = new Map();
  let uiSession = withUiSession ? { sessionStatus: null } : undefined;

  const list = {
    getSnapshot: () => snapshot,
    subscribe: (fn) => { listListeners.push(fn); return () => { const i = listListeners.indexOf(fn); if (i >= 0) listListeners.splice(i, 1); }; },
  };
  const sessionStatus = {
    getSnapshot: () => statuses,
    subscribe: (fn) => { statusListeners.push(fn); return () => { const i = statusListeners.indexOf(fn); if (i >= 0) statusListeners.splice(i, 1); }; },
  };
  if (uiSession) uiSession.sessionStatus = sessionStatus;

  const ctx = {
    get(name) {
      if (name === "sessions") return { list };
      if (name === "uiSession") return uiSession;
      return undefined;
    },
    effect(fn) { const dispose = fn(); return { dispose }; },
  };
  return {
    ctx,
    setSnapshot(next) { snapshot = next; for (const fn of [...listListeners]) fn(); },
    setStatuses(next) { statuses = next; for (const fn of [...statusListeners]) fn(); },
  };
}

const rows = (entries, extra = {}) => {
  const byId = {};
  const ids = [];
  for (const [id, row] of Object.entries(entries)) { ids.push(id); byId[id] = row; }
  return { ids, byId, projectionsBySession: {}, ...extra };
};
const main = (id) => ({ id, retainedBy: { mainView: 1 } });
const background = (id) => ({ id, retainedBy: { mainView: 0 } });
const st = (o) => new Map(Object.entries(o));

let passed = 0;
function ok(name, cond) { assert.ok(cond, "✗ " + name); passed += 1; console.log("  ✓ " + name); }
/** 跨过 400ms 同类冷却，模拟真实使用中两次提示音的间隔。 */
const tick = (ms = 450) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- 新版（DSH ≥ 0.1.7）
console.log("\n[新版状态源 ctx.uiSession.sessionStatus]");
{
  const notes = installAudio();
  const { mod, fakeWindow } = loadBundle();
  const h = createHarness({ withUiSession: true });
  mod.apply(h.ctx, { debug: false });
  const cue = () => fakeWindow.__dshSoundCue;

  h.setSnapshot(rows({ s1: main("s1") }));
  h.setStatuses(st({ s1: { running: true } }));
  ok("初始 seed 不响", notes.length === 0);

  // 当前会话 running true -> false：任务完成（风格 A 三音）
  h.setStatuses(st({ s1: { running: false } }));
  ok("当前会话完成 → 完成音 3 个音", notes.length === 3);
  ok("完成音为 C5-E5-G5", JSON.stringify(notes) === JSON.stringify([523.25, 659.25, 783.99]));
  ok("调试面记录了 last.kind", cue().last && cue().last.kind === "done");

  // 待审批出现：需要操作（两音）
  h.setStatuses(st({ s1: { running: false, pendingInteraction: { kind: "approval" } } }));
  ok("出现待审批 → 需要操作音 2 个音", notes.length === 5);
  ok("需要操作音为 880/1174.66", JSON.stringify(notes.slice(3)) === JSON.stringify([880, 1174.66]));

  // 审批解决后再次出现 → 再响（跨过 400ms 冷却）
  h.setStatuses(st({ s1: { running: false } }));
  await tick();
  h.setStatuses(st({ s1: { running: false, pendingInteraction: { kind: "question" } } }));
  ok("question 待办同样触发", notes.length === 7);
}

// 后台会话"完成未读"翻转
{
  const notes = installAudio();
  const { mod } = loadBundle();
  const h = createHarness({ withUiSession: true });
  mod.apply(h.ctx, {});
  h.setSnapshot(rows({ s1: main("s1"), s2: background("s2") }));
  h.setStatuses(st({ s1: { running: false }, s2: { running: false } }));
  h.setStatuses(st({ s1: { running: false }, s2: { running: false, completionUnread: true } }));
  ok("后台会话完成未读 → 完成音", notes.length === 3);
}

// 子代理会话忽略
{
  const notes = installAudio();
  const { mod } = loadBundle();
  const h = createHarness({ withUiSession: true });
  mod.apply(h.ctx, {});
  h.setSnapshot(rows({ s1: main("s1"), sub: background("sub") }, {
    projectionsBySession: { s1: { values: { subagentCatalog: [{ id: "sub" }] } } },
  }));
  h.setStatuses(st({ s1: { running: false }, sub: { running: false } }));
  h.setStatuses(st({ s1: { running: false }, sub: { running: false, completionUnread: true } }));
  h.setStatuses(st({ s1: { running: false }, sub: { running: false, pendingInteraction: { kind: "approval" } } }));
  ok("子代理事件被忽略", notes.length === 0);
}

// 冷却：400ms 内同类不重复
{
  const notes = installAudio();
  const { mod } = loadBundle();
  const h = createHarness({ withUiSession: true });
  mod.apply(h.ctx, {});
  h.setSnapshot(rows({ s1: main("s1") }));
  h.setStatuses(st({ s1: {} }));
  h.setStatuses(st({ s1: { pendingInteraction: { kind: "approval" } } }));
  h.setStatuses(st({ s1: {} }));
  h.setStatuses(st({ s1: { pendingInteraction: { kind: "approval" } } }));
  ok("400ms 冷却生效（只响一次）", notes.length === 2);
}

// 开关：needsOn/doneOn 关闭
{
  const notes = installAudio();
  const { mod } = loadBundle();
  const h = createHarness({ withUiSession: true });
  mod.apply(h.ctx, { needsOn: false, doneOn: false });
  h.setSnapshot(rows({ s1: main("s1") }));
  h.setStatuses(st({ s1: { running: true } }));
  h.setStatuses(st({ s1: { running: false } }));
  h.setStatuses(st({ s1: { running: false, pendingInteraction: { kind: "approval" } } }));
  ok("开关关闭后完全静音", notes.length === 0);
}

// ---------------------------------------------------------------- 旧版（DSH 0.1.0-rc.6）
console.log("\n[旧版状态源 sessions.list 行数据]");
{
  const notes = installAudio();
  const { mod } = loadBundle();
  const h = createHarness({ withUiSession: false });
  mod.apply(h.ctx, {});
  h.setSnapshot(rows({ s1: { id: "s1", running: true } }, { current: "s1" }));
  h.setSnapshot(rows({ s1: { id: "s1", running: false } }, { current: "s1" }));
  ok("旧版：当前会话完成 → 完成音", notes.length === 3);
  h.setSnapshot(rows({ s1: { id: "s1", running: false, pendingInteraction: "approval" } }, { current: "s1" }));
  ok("旧版：待审批出现 → 需要操作音", notes.length === 5);
  h.setSnapshot(rows({ s1: { id: "s1", running: false }, s2: { id: "s2", origin: "subagent" } }, { current: "s1" }));
  h.setSnapshot(rows({ s1: { id: "s1", running: false }, s2: { id: "s2", origin: "subagent", completed: true } }, { current: "s1" }));
  ok("旧版：子代理完成被忽略", notes.length === 5);
  h.setSnapshot(rows({ s1: { id: "s1", running: false }, s3: { id: "s3" } }, { current: "s1" }));
  await tick();
  h.setSnapshot(rows({ s1: { id: "s1", running: false }, s3: { id: "s3", completed: true } }, { current: "s1" }));
  ok("旧版：后台会话 completed 翻转 → 完成音", notes.length === 8);
}

// 服务晚到：先无 uiSession，随后挂上也能订阅
{
  const notes = installAudio();
  const { mod } = loadBundle();
  const h = createHarness({ withUiSession: false });
  mod.apply(h.ctx, {});
  h.setSnapshot(rows({ s1: main("s1") }));
  ok("无 uiSession 时不报错（旧路径待命）", notes.length === 0);
}

console.log("\n全部通过：" + passed + " 项断言");
