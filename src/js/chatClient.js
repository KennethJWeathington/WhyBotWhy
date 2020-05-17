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
/**
 * Returns whether the badges of a user allows them to access moderator actions.
 * @param {Array} badges Array of badges for a given user in Twitch Chat.
 */
function isModerator(badges) {
    return badges && !!(badges.broadcaster || badges.moderator);
}
exports.isModerator = isModerator;
const chatClient = tmi_js_1.client(opts);
exports.chatClient = chatClient;
