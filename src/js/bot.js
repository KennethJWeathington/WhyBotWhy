"use strict";
//#region Imports
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
dotenv_1.config();
const chatClient_1 = require("./chatClient");
const commandMap_1 = require("./commandMap");
//#endregion Imports
//#region tmi.js
chatClient_1.chatClient.on('message', onMessageHandler);
chatClient_1.chatClient.on('subscription', onSubscriptionHandler);
chatClient_1.chatClient.on('connected', onConnectedHandler);
//#endregion tmi.js
//#region Chat interaction
setup();
//#endregion Chat interaction
//#region Event Handlers
/**
 * Handler for message event of connection to Twitch Chat. Used to respond to messages and execute commands.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {tmi.Userstate} userState The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {boolean} self Whether the received message was from this bot or not.
 */
function onMessageHandler(channel, userState, msg, self) {
    if (self || userState['message-type'] != 'chat')
        return;
    const trimmedMsg = msg.trim();
    const arr = trimmedMsg.split(' ');
    const commandName = arr[0].toLowerCase();
    const commandElement = commandMap_1.commandMap.get(commandName);
    if (commandElement)
        commandElement.command(new commandMap_1.CommandArguments(channel, userState.username, trimmedMsg, arr, chatClient_1.isModerator(userState.badges)));
}
/**
 * Handler for subscription event of connection to Twitch Chat. Used to respond to subscriptions.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} username The username of the subscriber.
 */
function onSubscriptionHandler(channel, username) {
    chatClient_1.chatClient.say(channel, `Thank you for the subscription @${username}! Enjoy your stay.`);
}
/**
 * Handler for onConnected event of connection to Twitch Chat. Used to confirm connection.
 * @param {string} addr Address of Twitch IRC channel connected to.
 * @param {number} port Port connected to.
 */
function onConnectedHandler(addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
}
//#endregion Event Handlers
//#region Helper Functions
/**
 * Loads all documents required for chat interaction into chatElements and connects to Twitch Chat.
 */
async function setup() {
    await commandMap_1.setupCommands().catch((err) => handleError(err));
    console.log('All data loaded.');
    await chatClient_1.chatClient.connect();
    for (const channel of chatClient_1.chatClient.getChannels()) {
        startIntervals(channel);
    }
}
function startIntervals(channel) {
    for (const intervalCommand of commandMap_1.IntervalCommands) {
        setInterval(() => chatClient_1.chatClient.say(channel, intervalCommand.command()), intervalCommand.interval, channel);
    }
}
/**
 * Handles an error by logging the results in the console.
 * @param {string} msg String represting an error.
 */
function handleError(msg) {
    console.log(msg);
    return;
}
//#endregion Helper Functions
