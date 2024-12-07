// 踢人命令
export async function run(hazel, core, hold, socket, data) {
    // 先检查昵称
    if (!core.verifyNickname(data.nick)) {
        core.replyWarn("NICKNAME_INVALID", "昵称应当仅由汉字、字母、数字和不超过 3 个的特殊字符（_-+.:;）组成，而且不能太长。", socket);
        return;
    }
    // 查找目标用户
    let targetSocket = core.findSocket({
        channel: socket.channel,
        nick: data.nick,
    });
    // 如果目标用户不存在
    if (targetSocket.length < 1) {
        core.replyWarn("USER_NOT_FOUND", "在这个聊天室找不到您指定的用户。", socket);
        return;
    }
    // 按理说，目标用户只有一个
    [targetSocket] = targetSocket;
    // 踢出去
    core.replyInfo("KICKED_BY_ADMIN", "您已经被管理员断开连接。", targetSocket);
    // 通知全部管理员
    core.broadcastInfo("KICK_USER", socket.nick +
        " 在 " +
        socket.channel +
        " 踢出了 " +
        targetSocket.nick +
        "，目标 IP 地址为 `" +
        targetSocket.remoteAddress +
        "`。", core.findSocketByLevel(4), {
        from: socket.nick,
        channel: socket.channel,
        target: targetSocket.nick,
        ip: targetSocket.remoteAddress,
    });
    targetSocket.close();
    // 写入存档
    core.archive("KCK", socket, data.nick);
}
// 用户通过 /kick nick 的方式执行命令
export async function execByChat(hazel, core, hold, socket, line) {
    let targetNick = core.splitArgs(line)[1];
    // 验证输入的昵称
    if (!core.verifyNickname(targetNick)) {
        core.replyMalformedCommand(socket);
        return;
    }
    // 执行命令
    await run(hazel, core, hold, socket, { nick: targetNick });
}
export const name = "kick";
export const requiredLevel = 4;
export const requiredData = [{ nick: { description: "用户昵称" } }];
export const moduleType = "ws-command";
export const description = "踢出聊天室中某人";
