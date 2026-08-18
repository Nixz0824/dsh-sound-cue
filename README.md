# dsh-sound-cue

[中文](#zhongwen) · [English](#english)

> DSH Web 提示音：需要你操作时，与任务完成时，各响一声不同的短音。
>
> Two short Web Audio cues for DeepSeek Harness — one when you need to act, one when a task finishes.

![License](https://img.shields.io/github/license/Nixz0824/dsh-sound-cue)
![DSH](https://img.shields.io/badge/DSH-0.1.x-blue)

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

纯客户端实现，用 Web Audio 现场合成，**无弹窗、无系统通知、无音频文件依赖**。

### 行为

| 事件 | 触发条件 | 提示音（风格 A 默认） |
| --- | --- | --- |
| 需要操作 | 会话出现待审批 / 待回答 / 待计划确认（`pendingInteraction` 从无到有） | 叮咚双音（880→1175Hz，约 0.3s） |
| 任务完成 | 当前会话回合结束（`running` true→false），或后台会话完成提醒翻转（`completed`） | 上行琶音（C5-E5-G5，约 0.45s） |

- 子代理会话的事件默认忽略（`skipSubagents: true`）
- 同一种音 400ms 内不重复播放
- 浏览器自动播放策略：首次点击/按键后解锁 AudioContext（此后一直有效）
- 完全本地合成：无网络请求、无文件依赖、无隐私外发

### 安装

仓库是公开的，现在就可以装，不必等社区精选列表收录。

```bash
# 推荐：GitHub Release 预构建包
dsh plugin --profile web add https://github.com/Nixz0824/dsh-sound-cue/releases/latest/download/dsh-external-dsh-sound-cue-0.1.0.tgz

# 或直接从 GitHub 源码安装
dsh plugin --profile web add github:Nixz0824/dsh-sound-cue

# 或本地源码：
dsh plugin --profile web add "link:<本目录绝对路径>"
```

装完**刷新浏览器页面**即可生效（客户端 bundle 随页面加载）。重启 `dsh web` 一次更稳。

### 配置

写在本包 `cordis.patch.yml` 的 insert 行（也可在 profile 的 `cordis.patch.yml` 里覆盖）：

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `style` | `'A'` | `A` = 简约电子铃；`B` = 木质敲击（低频叩叩 + 咻—叮滑音） |
| `volume` | `0.5` | 音量 0..1 |
| `needsOn` | `true` | 「需要操作」提示音总开关 |
| `doneOn` | `true` | 「任务完成」提示音总开关 |
| `skipSubagents` | `true` | 忽略子代理会话事件 |

改配置后刷新页面生效。

### 结构

- `lib/index.js` —— 宿主入口（纯客户端插件，宿主侧为空）
- `lib/client.js` —— 客户端 bundle（官方 ModuleLoader 格式，免构建）
- `cordis.patch.yml` —— bundle 装配层（insert + 默认配置）
- `docs/` —— 试听页与两种提示音的 WAV

`lib/` 为手写维护的发布源；改完刷新页面即可。

### 开发

```bash
npm run check
python scripts/gen-preview-sounds.py   # 重新生成 docs/sounds/*.wav
```

### License

BSD-3-Clause.

---

<h2 id="english">English</h2>

Client-only. Cues are synthesized with the Web Audio API — **no popups, no OS notifications, no audio files at runtime**.

### Behavior

| Event | When | Cue (style A, default) |
| --- | --- | --- |
| Needs attention | A session gets a pending approval / question / plan review (`pendingInteraction` goes from absent to present) | Two-tone ding (880→1175 Hz, ~0.3s) |
| Task done | The current session turn ends (`running` true→false), or a background session flips `completed` | Rising arpeggio (C5-E5-G5, ~0.45s) |

- Subagent sessions are ignored by default (`skipSubagents: true`)
- The same cue will not replay within 400ms
- Browser autoplay policy: the first click or keypress unlocks `AudioContext`; it stays unlocked after that
- Fully local: no network, no file dependency, nothing leaves the machine

### Install

The repository is public. You can install it now; listing on the community catalog is separate.

```bash
# Recommended: GitHub Release tarball
dsh plugin --profile web add https://github.com/Nixz0824/dsh-sound-cue/releases/latest/download/dsh-external-dsh-sound-cue-0.1.0.tgz

# Or install from GitHub source
dsh plugin --profile web add github:Nixz0824/dsh-sound-cue

# or from a local checkout:
dsh plugin --profile web add "link:<absolute-path-to-this-folder>"
```

**Reload the browser page** after install (the client bundle loads with the page). Restart `dsh web` once if the plugin does not appear.

### Config

Set on the insert row in this package's `cordis.patch.yml` (or override from the profile `cordis.patch.yml`):

| Key | Default | Meaning |
| --- | --- | --- |
| `style` | `'A'` | `A` = short electronic bell; `B` = wooden knock (low double-tap + glide) |
| `volume` | `0.5` | 0..1 |
| `needsOn` | `true` | Master switch for the "needs attention" cue |
| `doneOn` | `true` | Master switch for the "task done" cue |
| `skipSubagents` | `true` | Ignore subagent session events |

Reload the page after changing config.

### Layout

- `lib/index.js` — host entry (empty; this plugin is client-only)
- `lib/client.js` — client bundle (official ModuleLoader format, no build)
- `cordis.patch.yml` — bundle patch (insert + defaults)
- `docs/` — listen page and the two preview WAVs

`lib/` is the hand-maintained source. Edit and reload.

### Development

```bash
npm run check
python scripts/gen-preview-sounds.py   # regenerate docs/sounds/*.wav
```

### License

BSD-3-Clause.
