/* @dsh-external/dsh-sound-cue — client bundle（手写产物，格式与官方 tsdown 输出一致，免构建）。
 *
 * 兼容两代客户端的会话状态来源：
 *   - DSH ≥ 0.1.7（Desktop / 新版 Web）：状态在 `ctx.uiSession.sessionStatus` 快照里
 *     每条记录形如 { running, pendingInteraction: { kind }, completionUnread }；
 *     当前会话用 `row.retainedBy.mainView > 0` 判定；子代理用父会话的
 *     `projectionsBySession[*].values.subagentCatalog` 判定。
 *   - DSH ≤ 0.1.0-rc.6（旧 Web）：状态直接在 `sessions.list` 行上
 *     （row.pendingInteraction / row.running / row.completed，当前会话为 snapshot.current）。
 * 两套来源同时订阅，哪套有数据用哪套；因此同一个 bundle 在新老客户端都能响。
 *
 * 触发规则：
 *   - 某会话 pendingInteraction 从无到有 → 播"需要操作"提示音
 *   - 当前会话 running true→false，或后台会话"完成未读"翻转 → 播"任务完成"提示音
 *
 * 提示音由 Web Audio 现场合成（两套风格，style 配置切换），无弹窗、无系统通知、无网络请求。
 * 风格 A（简约电子铃）：需要操作=880→1175Hz 叮咚双音；完成=C5-E5-G5 上行琶音
 * 风格 B（木质敲击）：需要操作=低频叩叩双敲；完成=500→1250Hz 滑音 + 高音收尾
 *
 * 调试：window.__dshSoundCue 始终记录 { count, last: { kind, sessionId, at } }；
 * 配置 debug:true 时额外在控制台打印每次触发。
 */
window.__ModuleLoader__.load({
  id: "dsh-sound-cue",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var inject = ["sessions"];

    function clamp01(v) {
      v = Number(v);
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
    }

    // ---- Web Audio 合成器 ----
    function makeSynth() {
      var actx = null;
      function ensure() {
        if (typeof window === "undefined") return null;
        var AC = typeof AudioContext !== "undefined" ? AudioContext : window.webkitAudioContext;
        if (!AC) return null;
        if (!actx) actx = new AC();
        if (actx.state === "suspended") actx.resume().catch(function () {});
        return actx;
      }
      // 单音调度：o = { freq, durMs, atMs, gain, decayExp, glideTo?, shape?, noise? }
      function tone(dest, o) {
        var c = ensure();
        if (!c) return;
        var t0 = c.currentTime + (o.atMs || 0) / 1000;
        var dur = o.durMs / 1000;
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = o.shape === "triangle" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(Math.max(1, o.freq), t0);
        if (o.glideTo && o.glideTo !== o.freq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), t0 + dur);
        }
        var peak = o.gain == null ? 0.5 : o.gain;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
        g.gain.setTargetAtTime(0.0001, t0 + 0.008, dur / (o.decayExp || 7));
        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(t0 + dur + 0.3);
        if (o.noise) {
          var len = Math.floor(c.sampleRate * 0.06);
          var buf = c.createBuffer(1, len, c.sampleRate);
          var d = buf.getChannelData(0);
          for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          var src = c.createBufferSource();
          src.buffer = buf;
          var ng = c.createGain();
          ng.gain.setValueAtTime(o.noise, t0);
          ng.gain.setTargetAtTime(0.0001, t0, 0.02);
          src.connect(ng);
          ng.connect(dest);
          src.start(t0);
        }
      }

      var NEEDS_A = [
        { freq: 880, durMs: 130, atMs: 0, gain: 0.7, decayExp: 7 },
        { freq: 1174.66, durMs: 130, atMs: 150, gain: 0.7, decayExp: 7 },
      ];
      var DONE_A = [
        { freq: 523.25, durMs: 150, atMs: 0, gain: 0.6, decayExp: 5 },
        { freq: 659.25, durMs: 150, atMs: 110, gain: 0.6, decayExp: 5 },
        { freq: 783.99, durMs: 220, atMs: 220, gain: 0.65, decayExp: 4 },
      ];
      var NEEDS_B = [
        { freq: 220, durMs: 100, atMs: 0, gain: 0.9, decayExp: 14, noise: 0.15 },
        { freq: 196, durMs: 100, atMs: 170, gain: 0.85, decayExp: 14, noise: 0.15 },
      ];
      var DONE_B = [
        { freq: 500, durMs: 240, atMs: 0, gain: 0.5, decayExp: 2.5, glideTo: 1250, shape: "triangle" },
        { freq: 1567.98, durMs: 170, atMs: 250, gain: 0.6, decayExp: 6 },
      ];

      function play(kind, style, volume) {
        var c = ensure();
        if (!c) return;
        var master = c.createGain();
        master.gain.value = clamp01(volume);
        master.connect(c.destination);
        var notes =
          kind === "needs"
            ? style === "B" ? NEEDS_B : NEEDS_A
            : style === "B" ? DONE_B : DONE_A;
        for (var i = 0; i < notes.length; i++) tone(master, notes[i]);
      }

      return {
        play: play,
        close: function () {
          if (actx) {
            actx.close().catch(function () {});
            actx = null;
          }
        },
      };
    }

    // ---- 会话状态读取（新老两代客户端） ----

    /** pendingInteraction 归一化为 kind 字符串；无待办返回 undefined。 */
    function pendingKind(raw) {
      if (raw === undefined || raw === null) return undefined;
      if (typeof raw === "string") return raw;
      if (typeof raw === "object") return raw.kind === undefined ? "interaction" : String(raw.kind);
      return String(raw);
    }

    /** 子代理会话：新客户端看父会话的 subagentCatalog，旧客户端看 row.origin。 */
    function isSubagent(row, snapshot, id) {
      if (row && row.origin === "subagent") return true;
      var projections = snapshot.projectionsBySession;
      if (projections === undefined || projections === null) return false;
      for (var parentId in projections) {
        var store = projections[parentId];
        var catalog = store && store.values && store.values.subagentCatalog;
        if (!Array.isArray(catalog)) continue;
        for (var i = 0; i < catalog.length; i++) {
          var child = catalog[i];
          if (child && child.id === id) return true;
        }
      }
      return false;
    }

    /** 当前会话 id：新客户端看 retainedBy.mainView，旧客户端看 snapshot.current。 */
    function currentSessionId(snapshot) {
      if (snapshot.current !== undefined) return snapshot.current;
      var byId = snapshot.byId;
      if (byId === undefined || byId === null) return undefined;
      for (var id in byId) {
        var row = byId[id];
        if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) return id;
      }
      return undefined;
    }

    /** 读取一次全量状态：id -> { pending, running, completed, subagent }。 */
    function readStates(list, statusSource) {
      var snapshot = list.getSnapshot() || {};
      var byId = snapshot.byId || {};
      var ids = Array.isArray(snapshot.ids) ? snapshot.ids : Object.keys(byId);
      var statuses = null;
      if (statusSource !== null) {
        try {
          statuses = statusSource.getSnapshot();
        } catch (e) {
          statuses = null;
        }
      }
      var current = currentSessionId(snapshot);
      var out = new Map();
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var row = byId[id];
        if (row === undefined || row === null) continue;
        var st = statuses !== null && typeof statuses.get === "function" ? statuses.get(id) : undefined;
        var pendingRaw = st !== undefined && st !== null ? st.pendingInteraction : row.pendingInteraction;
        var runningRaw = st !== undefined && st !== null && st.running !== undefined ? st.running : row.running;
        var completedRaw = st !== undefined && st !== null && st.completionUnread !== undefined ? st.completionUnread : row.completed;
        out.set(id, {
          pending: pendingKind(pendingRaw),
          running: runningRaw === true,
          completed: completedRaw === true,
          subagent: isSubagent(row, snapshot, id),
        });
      }
      return { states: out, current: current };
    }

    // ---- 客户端插件主体 ----
    function apply(ctx, config) {
      var cfg = config || {};
      var style = cfg.style === "B" ? "B" : "A"; // 默认 A（用户选定）
      var volume = clamp01(cfg.volume == null ? 0.5 : cfg.volume);
      var needsOn = cfg.needsOn !== false;
      var doneOn = cfg.doneOn !== false;
      var skipSubagents = cfg.skipSubagents !== false;
      var debug = cfg.debug === true;

      var synth = makeSynth();
      var lastPlayed = { needs: 0, done: 0 };

      // 调试面：始终记录最近一次触发，便于用户/开发自查"到底响没响"。
      if (typeof window !== "undefined") {
        window.__dshSoundCue = window.__dshSoundCue || { count: 0, last: null, config: { style: style, volume: volume, needsOn: needsOn, doneOn: doneOn, skipSubagents: skipSubagents } };
      }

      function play(kind, sessionId) {
        var now = Date.now();
        if (now - lastPlayed[kind] < 400) return; // 短冷却，防同刻连播
        lastPlayed[kind] = now;
        if (typeof window !== "undefined" && window.__dshSoundCue) {
          window.__dshSoundCue.count += 1;
          window.__dshSoundCue.last = { kind: kind, sessionId: sessionId, at: now };
        }
        if (debug && typeof console !== "undefined" && console.info) {
          console.info("[dsh-sound-cue] " + kind + (sessionId === undefined ? "" : " (" + sessionId + ")"));
        }
        synth.play(kind, style, volume);
      }

      // 浏览器自动播放策略：首次用户手势时静音预热解锁 AudioContext
      if (typeof window !== "undefined") {
        window.addEventListener("pointerdown", function unlock() {
          window.removeEventListener("pointerdown", unlock, true);
          synth.play("needs", style, 0);
        }, true);
        window.addEventListener("keydown", function unlock() {
          window.removeEventListener("keydown", unlock, true);
          synth.play("needs", style, 0);
        }, true);
      }

      var sessions = ctx.get("sessions");
      if (!sessions || !sessions.list) return;
      var list = sessions.list;

      // 新版客户端的状态源（UiSession 服务，非 React 也可取）；旧版为 null → 走行数据。
      var statusSource = null;
      var statusUnsubscribe = null;
      function bindStatusSource() {
        if (statusSource !== null) return true;
        var ui = typeof ctx.get === "function" ? ctx.get("uiSession") : undefined;
        if (!ui || !ui.sessionStatus || typeof ui.sessionStatus.subscribe !== "function") return false;
        statusSource = ui.sessionStatus;
        statusUnsubscribe = statusSource.subscribe(onChange);
        return true;
      }
      // 服务可能晚于本插件就绪：短暂轮询直到拿到，拿到后补订阅（最多 10 秒）。
      var statusPoll = null;
      if (!bindStatusSource() && typeof setInterval === "function") {
        var tries = 0;
        statusPoll = setInterval(function () {
          tries += 1;
          if (bindStatusSource() || tries >= 20) {
            clearInterval(statusPoll);
            statusPoll = null;
            if (statusSource !== null) onChange();
          }
        }, 500);
      }

      var prev = new Map(); // sessionId -> { pending, running, completed }
      function seed() {
        prev.clear();
        var read = readStates(list, statusSource);
        read.states.forEach(function (state, id) {
          prev.set(id, { pending: state.pending, running: state.running, completed: state.completed });
        });
      }
      seed();

      function onChange() {
        var read = readStates(list, statusSource);
        var current = read.current;
        read.states.forEach(function (state, id) {
          if (skipSubagents && state.subagent) return;
          var p = prev.get(id);
          if (p === undefined) {
            prev.set(id, { pending: state.pending, running: state.running, completed: state.completed });
            return;
          }
          var isCurrent = current !== undefined && id === current;
          // 需要操作：pendingInteraction 从无到有
          if (needsOn && p.pending === undefined && state.pending !== undefined) {
            play("needs", id);
          }
          if (doneOn) {
            var finished = isCurrent && p.running && !state.running && state.pending === undefined;
            var completedFlip = !p.completed && state.completed;
            if (finished || completedFlip) play("done", id);
          }
          prev.set(id, { pending: state.pending, running: state.running, completed: state.completed });
        });
      }

      var unsubscribe = list.subscribe(onChange);

      ctx.effect(function () {
        return function () {
          unsubscribe();
          if (statusUnsubscribe !== null) statusUnsubscribe();
          if (statusPoll !== null) clearInterval(statusPoll);
          synth.close();
        };
      }, "@dsh-external/dsh-sound-cue: watch");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
