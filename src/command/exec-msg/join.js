// 用于处理用户加入房间的请求
export async function run(hazel, core, hold, socket, data) {
    // 频率限制器计数
    core.checkAddress(socket.remoteAddress, 6);
    // 如果用户已经加入了聊天室，则不处理
    if (typeof socket.channel == "string") {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        return;
    }
    // 如果用户提供了 key，则必须提供 trip，反之亦然
    if ((typeof data.trip == "string") !== (typeof data.key == "string") &&
        typeof data.skey == "undefined" &&
        typeof data.bkey == "undefined") {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        return;
    }
    // 检查聊天室名称是否合法
    if (!core.verifyChannel(data.channel)) {
        core.replyWarn("CHANNEL_NAME_INVALID", "聊天室名称应当仅由汉字、字母和数字组成，并不超过 20 个字符。", socket);
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        return;
    }
    // 检查 CIDR
    if (!socket.isAllowedIP) {
        if (hold.checkCIDRchannelList.has(data.channel)) {
            if (hold.checkCIDRchannelList.get(data.channel)) {
                core.replyWarn("IP_NOT_ALLOWED", "## 訪問被拒絕\n\n非常抱歉，基於您的IP地址，您現在暫時不允許加入這個頻道。 您現在可以嘗試：\n\n一、十字街禁止某區域的使用通常是暫時性的，稍後再來這個聊天室。\n\n二、聯繫電郵： mail@henrize.kim 詢問可能的解封時間或將您暫時加入白名單的方法。\n\n現時十字街對IP的檢查和處理方法還不成熟，感謝您的耐心和支持。\n\n-----\n\n## Access Denied\n\nBased on your IP address, it is not allowed to join this channel right now. Please try again later.", socket);
                if (socket.readyState === WebSocket.OPEN) {
                    socket.close();
                }
                return;
            }
        }
        else {
            if (hold.checkCIDRglobal) {
                core.replyWarn("IP_NOT_ALLOWED", "## 訪問被拒絕\n\n非常抱歉，基於您的IP地址，您現在暫時不允許加入這個頻道。 您現在可以嘗試：\n\n一、十字街禁止某區域的使用通常是暫時性的，稍後再來這個聊天室。\n\n二、聯繫電郵： mail@henrize.kim 詢問可能的解封時間或將您暫時加入白名單的方法。\n\n現時十字街對IP的檢查和處理方法還不成熟，感謝您的耐心和支持。\n\n-----\n\n## Access Denied\n\nBased on your IP address, it is not allowed to join this channel right now. Please try again later.", socket);
                if (socket.readyState === WebSocket.OPEN) {
                    socket.close();
                }
                return;
            }
        }
    }
    // 用户信息模板
    const userInfo = {
        nick: "",
        permission: "USER",
        trip: null,
        level: core.config.level.user,
        isInvisible: false,
    };
    // 如果用户提供了 key 和 trip，则使用 key 验证已有的用户信息
    if (typeof data.trip == "string") {
        // 验证 nick、key 和 trip
        if (!(await (async () => {
            // 以下是一个 if 语句里的 IIFE
            // 先检查昵称和 trip 是否合规
            if (!core.verifyNickname(data.nick)) {
                return false;
            }
            if (!core.verifyTrip(data.trip)) {
                return false;
            }
            // 比较生成的哈希值与data.key
            return await core.vetifyKeys(data.password, data.key);
        })())) {
            // 如果验证失败，则返回错误信息
            core.reply({
                cmd: "infoInvalid",
            }, socket);
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            return;
        }
        // 没问题的话，保存用户信息
        userInfo.nick = data.nick;
        userInfo.trip = data.trip;
    }
    else {
        // 如果用户提供了密码，则使用密码生成 trip
        // 先检查昵称
        if (!core.verifyNickname(data.nick)) {
            core.replyWarn("NICKNAME_INVALID", "昵称应当仅由汉字、字母、数字和不超过 3 个的特殊字符（_-+.:;）组成，而且不能太长。", socket);
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            return;
        }
        // 使用昵称生成用户信息
        userInfo.nick = data.nick;
        // 如果用户提供了密码，则使用密码生成 trip
        if (typeof data.password == "string") {
            userInfo.trip = await core.generateTrips(data.password);
        }
    }
    // 判断用户是否为成员 / 管理员
    if (typeof userInfo.trip == "string") {
        if (core.config.adminList.includes(userInfo.trip)) {
            userInfo.permission = "ADMIN";
            userInfo.level = core.config.level.admin;
        }
        else if (core.config.memberList.includes(userInfo.trip)) {
            userInfo.permission = "MEMBER";
            userInfo.level = core.config.level.member;
        }
    }
    // 验证客户端名称的相关内容
    let cName = "null";
    if (typeof data.clientName == "string") {
        // 最常用的十字街网页版直接通过，加快速度
        if (data.clientName === "[十字街网页版](https://crosst.chat/)") {
            cName = data.clientName;
        }
        else {
            if (await (async () => {
                // 如果客户端名称中存在换行，直接返回 false
                if (data.clientName.indexOf("\r") !== -1 ||
                    data.clientName.indexOf("\n") !== -1) {
                    return false;
                }
                // 如果客户端名称超过 64 个字符，返回 false
                if (data.clientName.length > 64) {
                    return false;
                }
                // 如果客户端名称中没有暗示为官方客户端的关键字.
                return true;
            })()) {
                cName = data.clientName;
            }
        }
    }
    // 检查聊天室对象是否存在，如果不存在则创建
    if (!hold.channel.has(data.channel)) {
        hold.channel.set(data.channel, {
            isLocked: false,
            lastActive: Date.now(),
            socketList: new Set(),
        });
    }
    // 检查聊天室是否被锁定
    if (hold.channel.get(data.channel).isLocked || hold.lockAllChannels) {
        // 如果用户是成员或以上，则允许进入
        if (userInfo.level < core.config.level.member) {
            core.replyWarn("CHANNEL_LOCKED", "## 非常抱歉，该聊天室已锁定，即暂时禁止非成员进入。\n**可能的原因：**\n\\* 为提供更好的服务体验，十字街的 ?公共聊天室 一般会在深夜（北京时间）锁定。\n\\* 这个聊天室出现了大量且难以控制的违规行为，暂时锁定以维持秩序。\n**您可以尝试：**\n\\* 如果您是成员，请使用您的密码重新加入这个聊天室。\n\\* 暂时使用十字街的其它聊天室。\n\\* 一段时间后再来尝试加入本聊天室。", socket);
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            return;
        }
    }
    // 生成用户列表
    let channelNicks = [];
    hold.channel.get(data.channel).socketList.forEach((item) => {
        if (!item.isInvisible) {
            channelNicks.push(item.nick);
        }
    });
    // 检查用户昵称是否和其他用户重复
    let nickDuplicate = false;
    channelNicks.forEach((item) => {
        if (item.toLowerCase() === data.nick.toLowerCase()) {
            nickDuplicate = true;
        }
    });
    if (nickDuplicate) {
        core.replyWarn("NICKNAME_DUPLICATE", "已经有人在这个聊天室使用这个昵称，请换一个昵称再试。", socket);
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        return;
    }
    // 返回用户列表等信息
    if (typeof data.password == "string") {
        const generatedKey = await core.generateKeys(data.password);
        if (hold.noticeList.length > 0) {
            hold.noticeList.forEach((notice) => {
                core.reply({
                    cmd: "info",
                    code: "NOTICE",
                    text: notice,
                }, socket);
            });
        }
        core.reply({
            cmd: "onlineSet",
            nicks: channelNicks,
            trip: userInfo.trip,
            key: generatedKey,
        }, socket);
    }
    else {
        if (hold.noticeList.length > 0) {
            hold.noticeList.forEach((notice) => {
                core.reply({
                    cmd: "info",
                    code: "NOTICE",
                    text: notice,
                }, socket);
            });
        }
        core.reply({
            cmd: "onlineSet",
            nicks: channelNicks,
            ver: core.config.version,
        }, socket);
    }
    // 广播用户上线信息
    if (!userInfo.isInvisible) {
        core.broadcast({
            cmd: "onlineAdd",
            nick: userInfo.nick,
            trip: userInfo.trip || " ",
            utype: userInfo.permission,
            level: userInfo.level,
            client: cName,
            channel: data.channel,
        }, hold.channel.get(data.channel).socketList);
    }
    // 保存用户信息
    socket.nick = userInfo.nick;
    socket.trip = userInfo.trip;
    socket.permission = userInfo.permission;
    socket.level = userInfo.level;
    socket.channel = data.channel;
    socket.isInvisible = userInfo.isInvisible;
    // 将 socket 对象添加到聊天室的 socketList 中
    hold.channel.get(data.channel).socketList.add(socket);
    // 记录 stats
    core.increaseState("users-joined");
    // 写入存档
    if (userInfo.trip != null) {
        core.archive("JON", null, socket.remoteAddress +
            " (" +
            userInfo.permission +
            ")[" +
            userInfo.trip +
            "]" +
            userInfo.nick +
            " " +
            data.channel);
    }
    else {
        core.archive("JON", null, socket.remoteAddress +
            " (" +
            userInfo.permission +
            ")" +
            userInfo.nick +
            " " +
            data.channel);
    }
}
export const name = "join";
export const requiredLevel = 0;
export const requiredData = ["channel", "nick"];
export const moduleType = "ws-command-client";
