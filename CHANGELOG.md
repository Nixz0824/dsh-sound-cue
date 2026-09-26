# Changelog

## 0.2.0 — 2026-09-26

- **包名由 `@dsh-external/dsh-sound-cue` 改为 `dsh-sound-cue`**（npm 上可发布、安装命令更短）。
  已装旧版的话：卸载旧条目后按 README 重新安装一次即可，配置项完全兼容。
- **支持 DSH 0.1.7+（桌面版 / 新版 Web）**：会话实时状态改由 `ctx.uiSession.sessionStatus`
  提供，插件现在同时订阅该状态源与老的 `sessions.list` 行数据，两代客户端同一个 bundle。
  - 「需要操作」改为读取 `pendingInteraction.kind`（approval / question / plan-review …）
  - 「任务完成」的完成提醒字段由 `completed` 改为 `completionUnread`
  - 当前会话判定改用 `retainedBy.mainView`，子代理判定改用父会话的 `subagentCatalog`
- 新增 `debug` 配置（默认 `false`）：开启后在控制台打印每次触发。
- 新增只读调试面 `window.__dshSoundCue`：始终记录 `{ count, last: { kind, sessionId, at } }`，
  便于自查"提示音到底响没响"。
- 新增功能测试 `scripts/test-client.mjs`（16 项断言，覆盖新老两代状态模型、子代理跳过、冷却、开关）。
- 轮询等待 `uiSession` 服务的定时器在插件卸载时会正确清理。

## 0.1.0 — 2026-08-17

- Initial public release.
- Play a short “needs attention” cue when a session waits for approval, an answer, or plan confirmation.
- Play a different “task done” cue when the current turn finishes.
- Two built-in styles (`A` electronic chime, `B` wood knock) synthesized in the browser with Web Audio.
- No popups, no system notifications, no network calls.
