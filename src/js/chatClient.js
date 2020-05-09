"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tmi_js_1 = require("tmi.js");
const showDebug = process.env.SHOW_IRC_DEBUG_INFO.toLowerCase() === 'true';
const opts = {
    identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.OAUTH_TOKEN,
    },
    channels: [process.env.CHANNEL_NAME],
    connection: {
        reconnect: true,
        secure: true,
    },
    options: {
        debug: showDebug,
    },
};
const chatClient = tmi_js_1.client(opts);
exports.chatClient = chatClient;