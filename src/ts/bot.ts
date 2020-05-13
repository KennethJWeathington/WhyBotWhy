//#region Imports

import { config } from 'dotenv';
config();
import { chatClient, Userstate } from './chatClient';
import { commandMap, CommandArguments } from './commandMap';

//#endregion Imports

//#region tmi.js

chatClient.on('message', onMessageHandler);
chatClient.on('subscription', onSubscriptionHandler);
chatClient.on('connected', onConnectedHandler);

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
  if (commandElement)
    commandElement.command(
      new CommandArguments(channel, userState, trimmedMsg, arr)
    );
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

/**
 * Handler for onConnected event of connection to Twitch Chat. Used to confirm connection.
 * @param {string} addr Address of Twitch IRC channel connected to.
 * @param {number} port Port connected to.
 */
function onConnectedHandler(addr: string, port: number) {
  console.log(`* Connected to ${addr}:${port}`);
}

//#endregion Event Handlers

//#region Helper Functions

/**
 * Loads all documents required for chat interaction into chatElements and connects to Twitch Chat.
 */
async function setup() {
  const promArray = [
    loadChatElement(WhyQuoteModel, {}, 'whyQuotes', false, []),
    loadChatElement(CounterModel, { name: 'deaths' }, 'deaths', true),
    loadChatElement(CounterModel, { name: 'boops' }, 'boops', true),
    loadChatElement(
      SimpleTextCommandModel,
      {},
      'simpleTextCommands',
      false,
      []
    ),
  ];

  await Promise.all(promArray).catch((err) => handleError(err));
  chatElements.simpleTextCommands.forEach((element) =>
    addSimpleTextCommandToMap(element.command, element.text)
  );
  console.log('All data loaded.');
  await chatClient.connect();
  startIntervals();
}

/**
 * Handles an error by logging the results in the console.
 * @param {string} msg String represting an error.
 */
function handleError(msg: string) {
  console.log(msg);
  return;
}

/**
 * Returns whether the badges of a user allows them to access moderator actions.
 * @param {Array} badges Array of badges for a given user in Twitch Chat.
 */
function isModerator(badges: tmi.Badges) {
  return badges && (badges.broadcaster || badges.moderator);
}

//#endregion Helper Functions
