# dsh-sound-cue

[中文](#zhongwen) · [English](#english)

> DSH 提示音：需要你操作时，与任务完成时，各响一声不同的短音。
>
> Two short Web Audio cues for DeepSeek Harness — one when you need to act, one when a task finishes.

![License](https://img.shields.io/github/license/Nixz0824/dsh-sound-cue)
![DSH](https://img.shields.io/badge/DSH-0.1.0rc6%20~%200.1.7%2B-blue)
![Client-only](https://img.shields.io/badge/host-none-success)

**兼容性**：同一个包同时支持 **DSH 0.1.7+（桌面版 / 新版 Web）** 与 **0.1.0-rc.6（旧 Web）**。
纯客户端插件，宿主侧为空；无构建步骤（`lib/` 为手写发布源），GitHub 直装即可用。

## 试听 / Listen

点击即可试听默认风格 A 的两种提示音（与插件现场合成同一组音符）。若自动播放被浏览器拦住，页面上再点一次即可。

Click to hear the two default (style A) cues — the same notes the plugin synthesizes. If the browser blocks autoplay, click once more on the preview page.

| 中文 | English | Play |
| --- | --- | --- |
| 需要操作（审批 / 提问 / 计划确认） | Needs attention (approval / question / plan review) | **[▶ 试听 / Play](https://nixz0824.github.io/dsh-sound-cue/#needs)** |
| 任务完成 | Task done | **[▶ 试听 / Play](https://nixz0824.github.io/dsh-sound-cue/#done)** |

备用链接 / fallbacks:

- [预览页 Preview](https://nixz0824.github.io/dsh-sound-cue/) · [htmlpreview](https://htmlpreview.github.io/?https://github.com/Nixz0824/dsh-sound-cue/blob/main/docs/index.html)
- [needs.wav](docs/sounds/needs.wav) · [done.wav](docs/sounds/done.wav)

---

<h2 id="zhongwen">中文</h2>

纯客户端实现，用 Web Audio 现场合成，**无弹窗、无系统通知、无音频文件依赖、无网络请求**。

### 行为

| 事件 | 触发条件 | 提示音（风格 A 默认） |
| --- | --- | --- |
| 需要操作 | 会话出现待审批 / 待回答 / 待计划确认（`pendingInteraction` 从无到有） | 叮咚双音（880→1175Hz，约 0.3s） |
| 任务完成 | 当前会话回合结束（`running` true→false），或后台会话"完成未读"翻转 | 上行琶音（C5-E5-G5，约 0.45s） |

状态来源按客户端版本自动选择，插件同时订阅两套：

- **DSH ≥ 0.1.7**：`ctx.uiSession.sessionStatus`（`{ running, pendingInteraction: { kind }, completionUnread }`）；
  当前会话按 `retainedBy.mainView` 判定，子代理按父会话 `subagentCatalog` 判定。
- **DSH ≤ 0.1.0-rc.6**：`sessions.list` 行上的 `pendingInteraction / running / completed`，当前会话为快照的 `current`。

其它细节：

- 子代理会话的事件默认忽略（`skipSubagents: true`）
- 同一种音 400ms 内不重复播放
- 浏览器自动播放策略：首次点击/按键后解锁 AudioContext（此后一直有效）
- 完全本地合成：无网络请求、无文件依赖、无隐私外发

### 安装

#### 方式一：新版客户端内置插件页（推荐，无需命令行）

1. 打开 **设置 → 插件**，点 **添加插件**；
2. 在「包名或地址」里填下面任意一种：
   - npm 包名：`dsh-sound-cue`
   - GitHub 仓库：`https://github.com/Nixz0824/dsh-sound-cue`
   - 本地目录：本目录的绝对路径（自己开发时最方便）
3. 右上角可选安装源（中国大陆网络建议选「中国大陆镜像源」）；
4. 安装后**重启客户端**（面板会提示「更改将在下次启动生效」）。

#### 方式二：命令行

```bash
# 新版客户端（桌面版 profile 名为 desktop）
dsh plugin --profile desktop add github:Nixz0824/dsh-sound-cue

# 旧版 Web 客户端（profile 名为 web）
dsh plugin --profile web add github:Nixz0824/dsh-sound-cue

# GitHub Release 预构建 tgz（不依赖 git）
dsh plugin --profile desktop add https://github.com/Nixz0824/dsh-sound-cue/releases/latest/download/dsh-sound-cue-0.2.0.tgz

# 本地源码（改完刷新页面即可，无需重装）
dsh plugin --profile desktop add "link:<本目录绝对路径>"
```

装完重启客户端 / 刷新页面即可生效。

### 配置

本包 `cordis.patch.yml` 的 insert 行给出默认值，可在 **profile 的 `cordis.patch.yml`** 里按 id 覆盖：

```yaml
- id: sound-cue
  config:
    style: 'B'      # A=简约电子铃（默认）；B=木质敲击
    volume: 0.5     # 0..1
    needsOn: true
    doneOn: true
    skipSubagents: true
    debug: false    # true 时在控制台打印每次触发
```

改配置后重启客户端生效。

### 自查"到底响没响"

浏览器控制台里随时可看：

```js
window.__dshSoundCue
// { count: 3, last: { kind: "done", sessionId: "session-…", at: 1789… }, config: {…} }
```

### 结构

- `lib/index.js` —— 宿主入口（纯客户端插件，宿主侧为空）
- `lib/client.js` —— 客户端 bundle（官方 ModuleLoader 格式，免构建，手写维护）
- `cordis.patch.yml` —— bundle 装配层（insert + 默认配置）
- `scripts/test-client.mjs` —— 功能测试（伪造两代客户端状态模型 + 伪造 AudioContext）
- `docs/` —— 试听页与两种提示音的 WAV

### 开发

```bash
npm test                              # 语法检查 + smoke + 16 项功能断言
python scripts/gen-preview-sounds.py  # 重新生成 docs/sounds/*.wav
npm pack                              # 产出可发布的 tgz
```

### License

BSD-3-Clause.

---

<h2 id="english">English</h2>

Client-only. Cues are synthesized with the Web Audio API — **no popups, no OS notifications, no audio files, no network**.

**Compatibility**: one package covers **DSH 0.1.7+ (desktop & web)** and **0.1.0-rc.6 (legacy web)**.
The host half is empty and `lib/` ships prebuilt, so installing straight from GitHub works without a build step.

### Behavior

| Event | When | Cue (style A, default) |
| --- | --- | --- |
| Needs attention | A session gets a pending approval / question / plan review (`pendingInteraction` appears) | Two-tone ding (880→1175 Hz, ~0.3s) |
| Task done | The current session turn ends (`running` true→false), or a background session flips to unread-complete | Rising arpeggio (C5-E5-G5, ~0.45s) |

The status source is chosen per client version (both are subscribed):

- **DSH ≥ 0.1.7**: `ctx.uiSession.sessionStatus` (`{ running, pendingInteraction: { kind }, completionUnread }`); the current session is the row with `retainedBy.mainView`, subagents are found in the parent's `subagentCatalog`.
- **DSH ≤ 0.1.0-rc.6**: `pendingInteraction / running / completed` on `sessions.list` rows, with `current` in the snapshot.

- Subagent sessions are ignored by default (`skipSubagents: true`)
- The same cue will not replay within 400ms
- Browser autoplay policy: the first click or keypress unlocks `AudioContext`; it stays unlocked
- Fully local: no network, no file dependency, nothing leaves the machine

### Install

#### A. Built-in Plugins page (recommended)

1. Open **Settings → Plugins**, click **Add plugin**;
2. Paste any of: npm name `dsh-sound-cue`, the GitHub URL `https://github.com/Nixz0824/dsh-sound-cue`, or an absolute local path;
3. Pick a registry if needed;
4. **Restart the client** ("changes take effect on next launch").

#### B. CLI

```bash
dsh plugin --profile desktop add github:Nixz0824/dsh-sound-cue   # new desktop client
dsh plugin --profile web add github:Nixz0824/dsh-sound-cue       # legacy web client
dsh plugin --profile desktop add "link:<absolute-path>"          # local checkout
```

### Config

Defaults live in this package's `cordis.patch.yml`; override by id from the profile `cordis.patch.yml`:

```yaml
- id: sound-cue
  config:
    style: 'B'
    volume: 0.5
    needsOn: true
    doneOn: true
    skipSubagents: true
    debug: false
```

### Debug

```js
window.__dshSoundCue   // { count, last: { kind, sessionId, at }, config }
```

### Layout

- `lib/index.js` — host entry (empty; client-only plugin)
- `lib/client.js` — client bundle (official ModuleLoader format, hand-maintained, no build)
- `cordis.patch.yml` — bundle patch (insert + defaults)
- `scripts/test-client.mjs` — functional tests over both client generations
- `docs/` — listen page and the two preview WAVs

### Development

```bash
npm test       # syntax + smoke + 16 functional assertions
npm pack       # produce the publishable tarball
```

### License

BSD-3-Clause.

