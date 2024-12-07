// 向在线的所有用户广播消息
export async function run(hazel, core, hold, socket, data) {
    core.broadcast({
        cmd: "info",
        code: "BROADCAST",
        trip: "BODCST",
        text: data.text,
    }, core.findSocketByLevel(core.config.level.user));
    // 写入存档
    core.archive("BOD", socket, data.text);
}
// 用户使用 /broadcast xxxxxx 广播消息
export async function execByChat(hazel, core, hold, socket, line) {
    let text = core.splitArgs(line)[1].trim();
    // 如果没有输入消息内容
    if (text.length == 0) {
        core.replyMalformedCommand(socket);
        return;
    }
    await run(hazel, core, hold, socket, { text, level: core.config.level.user });
}
export const name = "broadcast";
export const requiredLevel = 4;
export const requiredData = [{ text: { description: "消息内容" } }];
export const moduleType = "ws-command";
export const description = "向在线的所有用户广播消息";
