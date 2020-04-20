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

function addQuote({ channel, tags, msg, arr }) {
  const quote = msg.slice(arr[0].length + 1);
  if (quote !== '') {
    createDocument(channel, 'Quote', chatElements.whyQuotes, WhyQuoteModel, { text: quote, user_added: tags.username });
  }
}

function getQuote({ channel }) {
  if (chatElements.whyQuotes.length > 0) {
    const quoteIndex = Math.floor(Math.random() * chatElements.whyQuotes.length);
    const quote = chatElements.whyQuotes[quoteIndex];
    client.say(channel, `"${quote.text}" - Added by @${quote.user_added} on ${quote.date_added.toLocaleDateString()}`);
  }
}

function incrementDeathCounter({ channel }) {
  if (chatElements.deaths) {
    chatElements.deaths.count++;
    updateDocument(channel, null, chatElements.deaths, null, null, `Troy has died embarrassingly ${chatElements.deaths.count} times on stream!`);
  }
}

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

function showBoopBoard({ channel }) {
  let scoreboardMessage = 'Top Boopers:'

  for (let i = 0; i < chatElements.boops.scoreboard.length && i < 3; i++) {
    const score = chatElements.boops.scoreboard[i];
    scoreboardMessage = scoreboardMessage + ` ${i + 1}. @${score.user}: ${score.count} boops,`;
  }
  client.say(channel, _.trimEnd(scoreboardMessage, ','));
}

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

function showRules({ channel }) {
  client.say(channel,
    `Please remember the channel rules:    
    1. Be kind
    2. No politics or religion
    3. No spam
    4. Only backseat if I ask for it`)
}

function showCommands({ channel }) {
  let commandMsg = 'Commands: '

  _.forIn(commandMap, (value, key) => { if (!value.mod_required) commandMsg += `${key} ` });

  client.say(channel, _.trimEnd(commandMsg));
}

//#endregion Command functions

//#region Event Handlers

function onMessageHandler(channel, tags, msg, self) {
  if (self) { return; }

  const trimmedMsg = msg.trim();
  const arr = trimmedMsg.split(' ');
  const commandName = _.toLower(arr[0]);

  const commandElement = commandMap[commandName];
  if (commandElement) commandElement.command({ channel, tags, msg: trimmedMsg, arr });
}

function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

//#endregion Event Handlers

//#region Helper Functions

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

async function loadChatElement(model, findObj, name) {
  const promise = model.find(findObj).exec();
  let result = await promise;
  if (result) chatElements[name] = result;
  else chatElements[name] = [];
  console.log(`Loaded ${name}`);
}

async function loadOneChatElement(model, findObj, name) {
  const promise = model.findOne(findObj).exec();
  let result = await promise;
  if (result) chatElements[name] = result;
  console.log(`Loaded ${name}`);
}

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

function deleteDocument(channel, name, model, searchObj) {
  model.deleteOne(searchObj, (err) => {
    if (err) handleError(err);
    else client.say(channel, `${name} deleted.`);
  })
}

function updateDocument(channel, name, obj, prop, newVal, msg) {
  if (prop) obj[prop] = newVal;
  if (!msg) msg = `${name} updated.`;

  obj.save((err) => {
    if (err) handleError(err);
    client.say(channel, msg);
  })
}

function handleError(msg) {
  console.log(msg);
  return;
}

function isModerator(badges) {
  return badges && (_.has(badges, 'broadcaster') || _.has(badges, 'moderator'));
}

// thisArg - context in which to call the function; 'this' in the function's body
// func - function to execute on a cooldown
// timeout - number of milliseconds to wait before allowing fn to be called again
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

function setCounter(channel, tags, arr, counterName, count = NaN) {
  if (chatElements[counterName] && isModerator(tags.badges)) {
    let num = 0;
    if (count) num = count;
    else if (arr.length > 1) num = _.toInteger(arr[1]);
    if (!_.isInteger(num)) num = 0;
    updateDocument(channel, null, chatElements[counterName], 'count', num, `${_.upperFirst(counterName)} set to ${num}.`)
  }
}

function addSimpleTextCommandToMap(command, text) {
  commandMap['!' + command] = { command: ({ channel }) => client.say(channel, text), mod_required: false };
}

//#endregion Helper Functions




