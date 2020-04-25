//#region Imports

require('dotenv').config()
import * as tmi from 'tmi.js';
import * as _ from 'lodash';
import * as mongoose from 'mongoose';
const request = require('request');
import WhyQuoteModel, { IWhyQuote } from './models/whyquote';
import CounterModel, { ICounter } from './models/counter';
import SimpleTextCommandModel, { ISimpleTextCommand } from './models/simpletextcommand';

//#endregion Imports

//#region Mongoose

const mongoDB = process.env.DB_CONN_STRING;
mongoose.connect(mongoDB, { useNewUrlParser: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

//#endregion Mongoose

//#region Environment Constant Parsing

const showDebug = _.toLower(process.env.SHOW_IRC_DEBUG_INFO) === 'true';
const cooldown = Number.parseInt(process.env.COMMAND_TIMEOUT);
const rulesInterval = Number.parseInt(process.env.RULES_TIMEOUT);

//#endregion Environment Constant Parsing

//#region tmi.js

const opts: tmi.Options = {
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
  },
  channels: [
    process.env.CHANNEL_NAME
  ],
  connection: {
    reconnect: true,
    secure: true
  },
  options: {
    debug: showDebug
  }
};

const client = tmi.client(opts);

client.on('message', onMessageHandler);
client.on('subscription', onSubscriptionHandler);
client.on('connected', onConnectedHandler);

//#endregion tmi.js

//#region Chat interaction

class ChatElements {
  whyQuotes: IWhyQuote[];
  simpleTextCommands: ISimpleTextCommand[];
  boops: ICounter;
  deaths: ICounter;
}

class Command {
  constructor(public command: Function, public mod_required: boolean) {
    this.command = command;
    this.mod_required = mod_required;
  }
}

const chatElements = new ChatElements();

const cooldownIncrementDeathCounter = createCooldownFunction(this, incrementDeathCounter, cooldown);
const cooldownIncrementBoopCounter = createCooldownFunction(this, incrementBoopCounter, cooldown);

const commandMap = new Map<string, Command>();
commandMap.set('!whyme', new Command(({ channel, tags }) => client.say(channel, `Why @${tags.username}, why???`), false));
commandMap.set('!addquote', new Command(addQuote, false));
commandMap.set('!quote', new Command(getQuote, false));
commandMap.set('!death', new Command(cooldownIncrementDeathCounter, false));
commandMap.set('!setdeaths', new Command(({ channel, tags, arr }) => setCounter(channel, tags, arr, 'deaths'), true));
commandMap.set('!boop', new Command(cooldownIncrementBoopCounter, false));
commandMap.set('!boopboard', new Command(showBoopBoard, false));
commandMap.set('!addcommand', new Command(addCommand, true));
commandMap.set('!removecommand', new Command(removeCommand, true));
commandMap.set('!rules', new Command(showRules, false));
commandMap.set('!commands', new Command(showCommands, false));
commandMap.set('!followage', new Command(showFollowage, false));

setup();

//#endregion Chat interaction

//#region Command functions

/**
 * Adds a quote to the WhyQuote collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
function addQuote({ channel, tags, msg, arr }) {
  const quote = msg.slice(arr[0].length + 1);
  if (quote !== '') {
    createDocument(channel, 'Quote', chatElements.whyQuotes, WhyQuoteModel, { text: quote.replace(/\/|\\/g,''), user_added: tags.username });
  }
}

/**
 * Sends a random WhyQuote to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function getQuote({ channel }) {
  if (chatElements.whyQuotes.length > 0) {
    const quoteIndex = Math.floor(Math.random() * chatElements.whyQuotes.length);
    const quote = chatElements.whyQuotes[quoteIndex];
    client.say(channel, `"${quote.text}" - Added by @${quote.user_added} on ${quote.date_added.toLocaleDateString()}`);
  }
}

/**
 * Increments the death counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementDeathCounter({ channel }) {
  if (chatElements.deaths) {
    chatElements.deaths.count++;
    updateDocument(channel, null, chatElements.deaths, null, null, `${process.env.STREAMER_NAME} has died embarrassingly ${chatElements.deaths.count} times on stream!`);
  }
}

/**
 * Increments the boop counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementBoopCounter({ channel, tags }) {
  if (chatElements.boops) {
    chatElements.boops.count++;

    let user = chatElements.boops.scoreboard.find(x => x.user = tags.username);
    if (user) user.count = user.count + 1;
    else chatElements.boops.scoreboard.push({ user: tags.username, count: 1 });

    chatElements.boops.scoreboard = chatElements.boops.scoreboard.sort((a, b) => b.count - a.count);

    updateDocument(channel, null, chatElements.boops, null, null, `@${tags.username} booped the snoot! The snoot has been booped ${chatElements.boops.count} times.`);
  }
}

/**
 * Assembles the boop leaderboard showing the users with the top 3 boop counts and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showBoopBoard({ channel }) {
  let scoreboardMessage = 'Top Boopers:'

  for (let i = 0; i < chatElements.boops.scoreboard.length && i < 3; i++) {
    const score = chatElements.boops.scoreboard[i];
    scoreboardMessage = scoreboardMessage + ` ${i + 1}. @${score.user}: ${score.count} boops,`;
  }
  client.say(channel, _.trimEnd(scoreboardMessage, ','));
}

/**
 * Adds a command to the SimpleTextCommand collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
function addCommand({ channel, tags, msg, arr }) {
  if (isModerator(tags.badges) && arr.length > 2) {
    if (commandMap[`!${arr[1]}`]) client.say(channel, 'Command already exists.');
    else {
      createDocument(channel, `Command !${arr[1]}`, chatElements.simpleTextCommands, SimpleTextCommandModel,
        { command: arr[1], text: msg.slice(arr[0].length + arr[1].length + 2).replace(/\/|\\/g,'') },
        (result) => addSimpleTextCommandToMap(result.command, result.text));
    }
  }
}

/**
 * Removes a command to the SimpleTextCommand collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
function removeCommand({ channel, tags, arr }) {
  if (isModerator(tags.badges) && arr.length > 1) {
    const removedCommands = _.remove(chatElements.simpleTextCommands, x => x.command === arr[1]);

    if (removedCommands.length > 0) {
      removedCommands.forEach(element => {
        const fullCommand = `!${element.command}`;
        delete commandMap[fullCommand];
        deleteDocument(channel, `Command ${fullCommand}`, SimpleTextCommandModel, { command: element.command });
      });
    } else { client.say(channel, 'Command not found.'); }
  }
}

/**
 * Sends a message containing the channel rules into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showRules({ channel }) {
  client.say(channel,process.env.RULES_COMMAND_TEXT);
}

/**
 * Sends a message containing non-moderator commands into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showCommands({ channel }) {
  let commandMsg = 'Commands: '

  // _.forIn(commandMap, (value: Command, key: string) => { if (!value.mod_required) commandMsg += `${key} ` });
  commandMap.forEach((value, key) => { if (!value.mod_required) commandMsg += `${key} `; })

  client.say(channel, _.trimEnd(commandMsg));
}

/**
 * Sends a message in Twitch Chat which contains how long the user has been following the channel.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 */
function showFollowage({ channel, tags }) {
  request(`https://api.2g.be/twitch/followage/${process.env.CHANNEL_NAME}/${tags.username}?format=mwdhms`,(error, response, body) => {
    if(error) handleError(error);
    if(response && response.statusCode === 200)
      client.say(channel, `@${body}`);
  });
}

function startIntervals() {
  const rulesIntervals: NodeJS.Timeout[] = [];
  opts.channels.forEach(channel => rulesIntervals.push(setInterval(showRules, rulesInterval, { channel })));
}

//#endregion Command functions

//#region Event Handlers
 
/**
 * Handler for message event of connection to Twitch Chat. Used to respond to messages and execute commands.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {boolean} self Whether the received message was from this bot or not.
 */
function onMessageHandler(channel, tags, msg, self) {
  if (self || tags['message-type'] != 'chat') { return; }

  const trimmedMsg = msg.trim();
  const arr = trimmedMsg.split(' ');
  const commandName = _.toLower(arr[0]);

  const commandElement = commandMap.get(commandName);
  if (commandElement) commandElement.command({ channel, tags, msg: trimmedMsg, arr });
}

/**
 * Handler for subscription event of connection to Twitch Chat. Used to respond to subscriptions.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} username The username of the subscriber.
 */
function onSubscriptionHandler(channel, username) {
  client.say(channel, `Thank you for the subscription @${username}! Enjoy your stay.`);
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
  const promArray = [
    loadChatElement(WhyQuoteModel, {}, 'whyQuotes', false, []),
    loadChatElement(CounterModel, { name: 'deaths' }, 'deaths', true),
    loadChatElement(CounterModel, { name: 'boops' }, 'boops', true),
    loadChatElement(SimpleTextCommandModel, {}, 'simpleTextCommands', false, []).then(
      () => chatElements.simpleTextCommands.forEach(element => addSimpleTextCommandToMap(element.command, element.text)))
  ]

  await Promise.all(promArray);
  console.log('All data loaded.')
  await client.connect();
  startIntervals();
}

/**
 * Loads multiple document object into chatElements.
 * @param {model} model Model of objects to load.
 * @param {Object} findObj Object containing search criteria for loaded objects.
 * @param {string} name Property name of chatElemnts that the document objects will be assigned to.
 * @param {boolean} loadOne Searches for and loads a single document if true.
 * @param {*} def Default value if no matching document found.
 * @returns {Promise<Document>} Promise containing loaded documents.
 */
async function loadChatElement(model, findObj, name, loadOne, def = null) {
  let promise;
  if(loadOne) promise = model.findOne(findObj).exec();
  else promise = model.find(findObj).exec();

  let result = await promise;
  if (result) chatElements[name] = result;
  else if(def) chatElements[name] = def;
  console.log(`Loaded ${name}`);
}


/**
 * Creates and saves a document object.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document deletes.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 * @param {model} model Model of schema of document to create.
 * @param {Object} createObj Object containing the initial values of the document to be created.
 * @param {Function} afterSaveFunc Callback function to be called after document successfully saves.
 */
function createDocument(channel, name, arr, model, createObj, afterSaveFunc = null) {
  model.create(createObj, (err, result) => {
    if (err) handleError(`Error creating ${name}.`);
    else {
      arr.push(result);
      if (afterSaveFunc) afterSaveFunc(result);
      client.say(channel, `${name} saved!`);
    }
  });
}

/**
 * Deleted documents matching the search criteria from the specified Collection of Documents.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document deletes.
 * @param {model} model Model of schema of document to delete.
 * @param {Object} searchObj Search criteria to limit deletion of documents.
 */
function deleteDocument(channel, name, model, searchObj) {
  model.deleteOne(searchObj, (err) => {
    if (err) handleError(err);
    else client.say(channel, `${name} deleted.`);
  })
}

/**
 * Updates a property on a document object if specified, then saves the document object.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document updates.
 * @param {Object} obj Object to update.
 * @param {string} [prop] Property on obj to update.
 * @param {*} [newVal] New value to set to prop.
 * @param {string} [msg] Message to display in chat after document updates.
 */
function updateDocument(channel, name, obj, prop, newVal, msg) {
  if (prop) obj[prop] = newVal;
  if (!msg) msg = `${name} updated.`;

  obj.save((err) => {
    if (err) handleError(err);
    client.say(channel, msg);
  })
}

/**
 * Handles an error by logging the results in the console.
 * @param {string} msg String represting an error.
 */
function handleError(msg) {
  console.log(msg);
  return;
}

/**
 * Returns whether the badges of a user allows them to access moderator actions.
 * @param {Array} badges Array of badges for a given user in Twitch Chat.
 */
function isModerator(badges) {
  return badges && (_.has(badges, 'broadcaster') || _.has(badges, 'moderator'));
}

/**
 * Create a modified function that will prevent subsequent executions until a timer(cooldown) runs out.
 * @param {this} thisArg Context to execute the function in.
 * @param {Function} func Function to execute on a cooldown.
 * @param {number} timeout Length of the cooldown.
 * @returns {Function} A modified function with a cooldown that prevents rapid execution.
 */
function createCooldownFunction(thisArg, func, timeout) {
  let onCooldown = false;

  return (...arr) => {
    if (!onCooldown) {
      func.apply(thisArg, arr);
      onCooldown = true;
      setTimeout(() => onCooldown = false, timeout);
    }
  }
}

/**
 * A moderator-only function to set a counter to specified number.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 * @param {string} counterName Name of the counter to modify.
 * @param {number} count Count to set the counter to.
 */
function setCounter(channel, tags, arr, counterName, count = NaN) {
  if (chatElements[counterName] && isModerator(tags.badges)) {
    let num = 0;
    if (count) num = count;
    else if (arr.length > 1) num = _.toInteger(arr[1]);
    if (!_.isInteger(num)) num = 0;
    updateDocument(channel, null, chatElements[counterName], 'count', num, `${_.upperFirst(counterName)} set to ${num}.`)
  }
}

/**
 * Adds a simple text command to the command map.
 * @param {string} command The keyword that will invoke the command.
 * @param {string} text The text that will display with the command is invoked.
 */
function addSimpleTextCommandToMap(command, text) {
  commandMap['!' + command] = { command: ({ channel }) => client.say(channel, text), mod_required: false };
}

//#endregion Helper Functions




