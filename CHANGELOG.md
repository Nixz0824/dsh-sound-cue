# Changelog

## Unreleased

- Fix / 修复：「需要操作」提示音在 DSH 0.1.5+ 上静默失效。待审批 / 待回答 / 待计划确认
  不再挂在会话列表行上，改为从 `uiSession.pendingInteractions`（`Map<sessionId, interaction>`）
  读取；同时保留旧版行字段 `row.pendingInteraction` 作为回退路径，
  因此 DSH 0.1.0.x 与 0.1.5+ 均可正常工作。
- Chore：修正 `dsh.client.inject`。`@deepseek-ai/dsh-client-runtime` 在 DSH 0.1.5 中已不存在，
  改为实际提供这两个客户端服务的 `@deepseek-ai/dsh-api-session-controller`
  与 `@deepseek-ai/dsh-client-ui-session`。

## 0.1.0 — 2026-08-17

- Initial public release.
- Play a short “needs attention” cue when a session waits for approval, an answer, or plan confirmation.
- Play a different “task done” cue when the current turn finishes.
- Two built-in styles (`A` electronic chime, `B` wood knock) synthesized in the browser with Web Audio.
- No popups, no system notifications, no network calls.
