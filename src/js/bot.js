//#region Requires

require('dotenv').config()
const tmi = require('tmi.js');
const _ = require('lodash');
const mongoose = require('mongoose');

//#endregion Requires

//#region Mongoose

const mongoDB = process.env.DB_CONN_STRING;
mongoose.connect(mongoDB, { useNewUrlParser: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const WhyQuoteModel = require('../models/whyquote');
const CounterModel = require('../models/counter');
const SimpleTextCommandModel = require('../models/simpletextcommand');

//#endregion Mongoose

//#region tmi.js

const opts = {
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
    debug: process.env.SHOW_IRC_DEBUG_INFO
  }
};

const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

//#endregion tmi.js

//#region Chat interaction

const chatElements = {};

const cooldownIncrementDeathCounter = createCooldownFunction(this, incrementDeathCounter, 10000);
const cooldownIncrementBoopCounter = createCooldownFunction(this, incrementBoopCounter, 10000);

const commandMap = new Map();
commandMap['!whyme'] = { command: ({ channel, tags }) => client.say(channel, `Why @${tags.username}, why???`), mod_required: false };
commandMap['!addquote'] = { command: addQuote, mod_required: false };
commandMap['!quote'] = { command: getQuote, mod_required: false };
commandMap['!death'] = { command: cooldownIncrementDeathCounter, mod_required: false };
commandMap['!setdeaths'] = { command: ({ channel, tags, arr }) => setCounter(channel, tags, arr, 'deaths'), mod_required: true };
commandMap['!boop'] = { command: cooldownIncrementBoopCounter, mod_required: false };
commandMap['!boopboard'] = { command: showBoopBoard, mod_required: false };
commandMap['!addcommand'] = { command: addCommand, mod_required: true };
commandMap['!removecommand'] = { command: removeCommand, mod_required: true };
commandMap['!rules'] = { command: showRules, mod_required: false };
commandMap['!commands'] = { command: showCommands, mod_required: false };

setup();

const rulesIntervals = [];
opts.channels.forEach(channel => rulesIntervals.push(setInterval(showRules, 1800000, channel)));

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
    createDocument(channel, 'Quote', chatElements.whyQuotes, WhyQuoteModel, { text: quote, user_added: tags.username });
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
    updateDocument(channel, null, chatElements.deaths, null, null, `Troy has died embarrassingly ${chatElements.deaths.count} times on stream!`);
  }
}

/**
 * Increments the boop counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementBoopCounter({ channel, tags }) {
  if (chatElements.boops) {
    chatElements.boops.count++;

    let user = chatElements.boops.scoreboard.find(x => x.userName = tags.username);
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
        { command: arr[1], text: msg.slice(arr[0].length + arr[1].length + 2) },
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
  client.say(channel,
    `Please remember the channel rules:    
    1. Be kind
    2. No politics or religion
    3. No spam
    4. Only backseat if I ask for it`)
}

/**
 * Sends a message containing non-moderator commands into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showCommands({ channel }) {
  let commandMsg = 'Commands: '

  _.forIn(commandMap, (value, key) => { if (!value.mod_required) commandMsg += `${key} ` });

  client.say(channel, _.trimEnd(commandMsg));
}

//#endregion Command functions

//#region Event Handlers
 
/**
 * Handler for onMessage event of connection to Twitch Chat. Used to respond to messages and execute commands.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {boolean} self Whether the received message was from this bot or not.
 */
function onMessageHandler(channel, tags, msg, self) {
  if (self) { return; }

  const trimmedMsg = msg.trim();
  const arr = trimmedMsg.split(' ');
  const commandName = _.toLower(arr[0]);

  const commandElement = commandMap[commandName];
  if (commandElement) commandElement.command({ channel, tags, msg: trimmedMsg, arr });
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
  const prom1 = loadChatElement(WhyQuoteModel, {}, 'whyQuotes');
  const prom2 = loadOneChatElement(CounterModel, { name: 'deaths' }, 'deaths');
  const prom3 = loadOneChatElement(CounterModel, { name: 'boops' }, 'boops');
  const prom4 = loadChatElement(SimpleTextCommandModel, {}, 'simpleTextCommands').then(
    () => chatElements.simpleTextCommands.forEach(element => addSimpleTextCommandToMap(element.command, element.text))
  );

  const promArray = [prom1, prom2, prom3, prom4];

  await Promise.all(promArray);
  console.log('All data loaded.')
  client.connect();
}

/**
 * Loads multiple document object into chatElements.
 * @param {model} model Model of objects to load.
 * @param {Object} findObj Object containing search criteria for loaded objects.
 * @param {string} name Property name of chatElemnts that the document objects will be assigned to.
 * @returns {Promise<Document>} Promise containing loaded documents.
 */
async function loadChatElement(model, findObj, name) {
  const promise = model.find(findObj).exec();
  let result = await promise;
  if (result) chatElements[name] = result;
  else chatElements[name] = [];
  console.log(`Loaded ${name}`);
}

/**
 * Loads a single document object into chatElements.
 * @param {model} model Model of object to load.
 * @param {Object} findObj Object containing search criteria for loaded object.
 * @param {string} name Property name of chatElemnts that the document object will be assigned to.
 * @returns {Promise<Document>} Promise containing loaded document.
 */
async function loadOneChatElement(model, findObj, name) {
  const promise = model.findOne(findObj).exec();
  let result = await promise;
  if (result) chatElements[name] = result;
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




