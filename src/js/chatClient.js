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
let messageHandler;
let subscriptionHandler;
/**
 * Returns whether the badges of a user allows them to access moderator actions.
 * @param {Array} badges Array of badges for a given user in Twitch Chat.
 */
function isModerator(badges) {
    return badges && !!(badges.broadcaster || badges.moderator);
}
function onMessageHandler(channel, userState, msg, self) {
    if (self || userState['message-type'] != 'chat')
        return;
    const message = messageHandler(msg, userState.username, isModerator(userState.badges));
    if (message)
        for (const channel of chatClient.getChannels())
            chatClient.say(channel, message);
}
function setMessageHandler(handler) {
    messageHandler = handler;
    chatClient.on('message', onMessageHandler);
}
exports.setMessageHandler = setMessageHandler;
function onSubscriptionHandler(channel, username) {
    chatClient.say(channel, subscriptionHandler(username));
}
function setSubscriberHandler(handler) {
    subscriptionHandler = handler;
    chatClient.on('subscription', onSubscriptionHandler);
}
