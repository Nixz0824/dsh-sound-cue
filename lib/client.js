/* @dsh-external/dsh-sound-cue — client bundle（手写产物，格式与官方 tsdown 输出一致，免构建）。
 *
 * 待交互来源（"需要操作"提示音）：
 *   - DSH >= 0.1.5：uiSession.pendingInteractions（Map<sessionId, interaction>）
 *   - DSH <  0.1.5：会话列表行上的 row.pendingInteraction（回退路径）
 * 任务完成来源（"任务完成"提示音）：
 *   - 当前会话 running true→false，或后台会话 completed 翻转
 *
 * 提示音由 Web Audio 现场合成（两套风格，style 配置切换），无任何弹窗、无系统通知。
 * 风格 A（简约电子铃）：需要操作=880→1175Hz 叮咚双音；完成=C5-E5-G5 上行琶音
 * 风格 B（木质敲击）：需要操作=低频叩叩双敲；完成=500→1250Hz 滑音 + 高音收尾
 */
window.__ModuleLoader__.load({
  id: "@dsh-external/dsh-sound-cue",
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

    // ---- 客户端插件主体 ----
    function apply(ctx, config) {
      var cfg = config || {};
      var style = cfg.style === "B" ? "B" : "A"; // 默认 A（用户选定）
      var volume = clamp01(cfg.volume == null ? 0.5 : cfg.volume);
      var needsOn = cfg.needsOn !== false;
      var doneOn = cfg.doneOn !== false;
      var skipSubagents = cfg.skipSubagents !== false;

      var synth = makeSynth();
      var lastPlayed = { needs: 0, done: 0 };
      function play(kind) {
        var now = Date.now();
        if (now - lastPlayed[kind] < 400) return; // 短冷却，防同刻连播
        lastPlayed[kind] = now;
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

      // DSH >= 0.1.5 把待审批 / 待回答 / 待计划确认从会话列表行上移走了，
      // 改由 uiSession.pendingInteractions 存储发布（Map<sessionId, interaction>，
      // 交互对象带 key / sessionId / kind ∈ approval | question | plan-review）。
      // 这里软依赖 uiSession：它在场就用它，不在场则回退到旧版的行字段，
      // 因此插件在 0.1.0.x 与 0.1.5+ 上都能工作，也不会因为缺 uiSession 而无法激活。
      var pendingStore = null;
      ctx.inject(["uiSession"], function (uiCtx) {
        var uiSession = uiCtx.get("uiSession");
        var store = uiSession && uiSession.pendingInteractions;
        if (!store || typeof store.getSnapshot !== "function" || typeof store.subscribe !== "function") return;
        pendingStore = store;
        var seenPending = new Set();
        store.getSnapshot().forEach(function (_interaction, sessionId) {
          seenPending.add(sessionId);
        });
        var unsubscribe = store.subscribe(function () {
          var nextPending = new Set();
          store.getSnapshot().forEach(function (_interaction, sessionId) {
            nextPending.add(sessionId);
            // 需要操作：该会话的待交互从无到有
            if (!needsOn || seenPending.has(sessionId)) return;
            var row = list.getSnapshot().byId[sessionId];
            if (skipSubagents && row && row.origin === "subagent") return;
            play("needs");
          });
          seenPending = nextPending;
        });
        uiCtx.effect(function () {
          return function () {
            unsubscribe();
            if (pendingStore === store) pendingStore = null;
          };
        }, "@dsh-external/dsh-sound-cue: pending interactions");
      });

      var prev = new Map(); // sessionId -> { pending, completed, running }
      function seed() {
        prev.clear();
        var snap = list.getSnapshot();
        var ids = snap.ids || [];
        for (var i = 0; i < ids.length; i++) {
          var row = snap.byId[ids[i]];
          if (row) prev.set(ids[i], { pending: row.pendingInteraction, completed: !!row.completed, running: !!row.running });
        }
      }
      seed();

      var unsub = list.subscribe(function () {
        var snap = list.getSnapshot();
        var ids = snap.ids || [];
        for (var i = 0; i < ids.length; i++) {
          var id = ids[i];
          var row = snap.byId[id];
          if (!row) continue;
          if (skipSubagents && row.origin === "subagent") continue;
          var p = prev.get(id);
          if (!p) {
            prev.set(id, { pending: row.pendingInteraction, completed: !!row.completed, running: !!row.running });
            continue;
          }
          var isCurrent = id === snap.current;
          // 需要操作（旧版 DSH 回退路径）：行上的 pendingInteraction 从无到有。
          // 新版下该字段恒为 undefined，因此这条分支不会触发，也不会重复响。
          if (!pendingStore && needsOn && p.pending === undefined && row.pendingInteraction !== undefined) {
            play("needs");
          }
          if (doneOn) {
            // 仍有交互在等用户时不播"完成"：新版查存储，旧版查行字段
            var stillPending = pendingStore
              ? pendingStore.getSnapshot().has(id)
              : row.pendingInteraction !== undefined;
            var finished = isCurrent && p.running && !row.running && !stillPending;
            var completedFlip = !p.completed && !!row.completed;
            if (finished || completedFlip) play("done");
          }
          prev.set(id, { pending: row.pendingInteraction, completed: !!row.completed, running: !!row.running });
        }
      });

      ctx.effect(function () {
        return function () {
          unsub();
          synth.close();
        };
      }, "@dsh-external/dsh-sound-cue: watch");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
