// dsh-sound-cue — host entry（纯客户端插件，宿主侧无服务）。
// 全部逻辑在 ./client（浏览器侧）：订阅会话状态（新版 ctx.uiSession.sessionStatus /
// 旧版 sessions.list 行数据）播放提示音。
export const name = 'dsh-sound-cue'
export const inject = []
export function apply(_ctx) {}
