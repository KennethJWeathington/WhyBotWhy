//#region Imports

import { config } from 'dotenv';
config();
import { setMessageHandler } from './chatClient';
import {
  commandMap,
  CommandArguments,
  setupCommands,
  IntervalCommands,
} from './commandMap';

//#endregion Imports

//#region tmi.js

chatClient.on('message', onMessageHandler);
chatClient.on('subscription', onSubscriptionHandler);

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
function onMessageHandler(
  channel: string,
  userState: Userstate,
  msg: string,
  self: boolean
) {
  if (self || userState['message-type'] != 'chat') return;

  const trimmedMsg = msg.trim();
  const arr = trimmedMsg.split(' ');
  const commandName = arr[0].toLowerCase();

  const commandElement = commandMap.get(commandName);
  if (commandElement) {
    const message = commandElement.command(
      new CommandArguments(
        userState.username,
        trimmedMsg,
        arr,
        isModerator(userState.badges)
      )
    );
    for (const channel of chatClient.getChannels()) {
      chatClient.say(channel, message);
    }
  }
}

function processMessage(
  message: string,
  userName: string,
  isModerator: boolean
): string {
  let outputMessage = '';

  const trimmedMessage = message.trim();
  const messageWords = trimmedMessage.split(' ');
  const commandName = messageWords[0].toLowerCase();

  const commandElement = commandMap.get(commandName);
  if (commandElement) {
    outputMessage = commandElement.command(
      new CommandArguments(userName, trimmedMessage, messageWords, isModerator)
    );
  }

  return outputMessage;
}

/**
 * Handler for subscription event of connection to Twitch Chat. Used to respond to subscriptions.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} username The username of the subscriber.
 */
function onSubscriptionHandler(channel: string, username: string) {
  chatClient.say(
    channel,
    `Thank you for the subscription @${username}! Enjoy your stay.`
  );
}

//#endregion Event Handlers

//#region Helper Functions

/**
 * Loads all documents required for chat interaction into chatElements and connects to Twitch Chat.
 */
async function setup() {
  await setupCommands().catch((err) => handleError(err));
  console.log('All data loaded.');
  await chatClient.connect();

  for (const channel of chatClient.getChannels()) {
    startIntervals(channel);
  }
}

function startIntervals(channel: string) {
  for (const intervalCommand of IntervalCommands) {
    setInterval(
      () => chatClient.say(channel, intervalCommand.command()),
      intervalCommand.interval,
      channel
    );
  }
}

/**
 * Handles an error by logging the results in the console.
 * @param {string} msg String represting an error.
 */
function handleError(msg: string) {
  console.log(msg);
  return;
}

//#endregion Helper Functions
