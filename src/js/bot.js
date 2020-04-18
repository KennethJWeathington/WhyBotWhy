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

client.connect();

//#endregion tmi.js

//#region Chat interaction

const chatElements = {};
WhyQuoteModel.find(function (err, result) {
  loadChatElementCallback(err, result, 'whyQuotes');
});
CounterModel.findOne({ name: 'deaths' }, function (err, result) {
  loadChatElementCallback(err, result, 'deaths');
});
CounterModel.findOne({ name: 'boops' }, function (err, result) {
  loadChatElementCallback(err, result, 'boops');
});

const cooldownIncrementDeathCounter = createCooldownFunction(this, incrementDeathCounter, 10000);
const cooldownIncrementBoopCounter = createCooldownFunction(this, incrementBoopCounter, 10000);

const commandMap = {
  '!dice': rollDice,
  '!whyme': function ({channel, tags}) {
    client.say(channel, `Why @${tags.username}, why???`);
  },
  '!addquote': addQuote,
  '!quote': getQuote,
  '!death': cooldownIncrementDeathCounter,
  '!setdeaths': function ({channel, tags, arr}) {
    setCounter(channel, tags, arr, 'deaths');
  },
  '!boop': cooldownIncrementBoopCounter,
  '!boopboard': showBoopBoard,
  '!addcommand': addCommand,
  '!removecommand': removeCommand,
  '!rules': showRules
}

SimpleTextCommandModel.find(function (err, result) {
  loadChatElementCallback(err, result, 'simpleTextCommands');
  if (chatElements.simpleTextCommands) {
    chatElements.simpleTextCommands.forEach(element => {
      addSimpleTextCommandToMap(element.command, element.text);
    });
  } else {
    chatElements.simpleTextCommands = [];
  }
});

const rulesIntervals = [];
opts.channels.forEach(element => {
  const rulesInterval = setInterval(showRules,1800000, element);
  rulesIntervals.push(rulesInterval);  
});


//#endregion Chat interaction

//#region Command functions

function rollDice({channel}) {
  const sides = 6;
  const num = Math.floor(Math.random() * sides) + 1;
  client.say(channel, `You rolled a ${num}!`)
}

function addQuote({channel, tags, msg, arr}) {
  const quote = msg.slice(arr[0].length + 1);
  if (quote && quote !== '') {
    createDocument(channel, 'Quote', chatElements.whyQuotes, WhyQuoteModel, { text: quote, user_added: tags.username });
  }
}

function getQuote({channel}) {
  if (chatElements.whyQuotes.length > 0) {
    const quoteIndex = Math.floor(Math.random() * chatElements.whyQuotes.length);
    const quote = chatElements.whyQuotes[quoteIndex];
    client.say(channel, `"${quote.text}" - Added by @${quote.user_added} on ${quote.date_added.toLocaleDateString()}`);
  }
}

function incrementDeathCounter({channel}) {
  if (chatElements.deaths) {
    chatElements.deaths.count++;
    updateDocument(channel, null, chatElements.deaths, null, null, `Troy has died embarrassingly ${chatElements.deaths.count} times on stream!`);
  }
}

function incrementBoopCounter({channel, tags}) {
  if (chatElements.boops) {
    chatElements.boops.count++;

    let user = chatElements.boops.scoreboard.find(x => x.userName = tags.username);
    if (user) user.count = user.count + 1;
    else chatElements.boops.scoreboard.push({ user: tags.username, count: 1 });

    chatElements.boops.scoreboard = chatElements.boops.scoreboard.sort((a, b) => b.count - a.count);

    updateDocument(channel, null, chatElements.boops, null, null, `@${tags.username} booped the snoot! The snoot has been booped ${chatElements.boops.count} times.`);
  }
}

function showBoopBoard({channel}) {
  let scoreboardMessage = 'Top Boopers:'

  for (let i = 0; i < chatElements.boops.scoreboard.length && i < 3; i++) {
    const score = chatElements.boops.scoreboard[i];
    scoreboardMessage = scoreboardMessage + ` ${i + 1}. @${score.user}: ${score.count} boops,`;
  }
  client.say(channel, _.trimEnd(scoreboardMessage, ','));
}

function addCommand({channel, tags, msg, arr}) {
  if (isModerator(tags.badges) && arr.length > 2) {
    if (commandMap[`!${arr[1]}`]) client.say(channel, 'Command already exists.');
    else {
      createDocument(channel, `Command !${arr[1]}`, chatElements.simpleTextCommands, SimpleTextCommandModel,
        { command: arr[1], text: msg.slice(arr[0].length + arr[1].length + 2) },
        function (result) { addSimpleTextCommandToMap(result.command, result.text); });
    }
  }
}

function removeCommand({channel, tags, arr}) {
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

function showRules({channel}) {
  client.say(channel,
    `Please remember the channel rules:    
    1. Be kind
    2. No politics or religion
    3. No spam
    4. Only backseat if I ask for it`)
}

//#endregion Command functions

//#region Event Handlers

function onMessageHandler(channel, tags, msg, self) {
  if (self) { return; }

  const trimmedMsg = msg.trim();
  const arr = trimmedMsg.split(' ');
  const commandName = _.toLower(arr[0]);

  const command = commandMap[commandName];
  if (command) command({ channel, tags, msg: trimmedMsg, arr });
}

function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

//#endregion Event Handlers

//#region Helper Functions

function loadChatElementCallback(err, result, propName) {
  const err_msg = `Error loading ${propName}.`;
  const succ_msg = `Successfully loaded ${propName}!`;

  if (err) handleError(err_msg);
  else if (result) {
    chatElements[propName] = result;
    console.log(succ_msg);
  }
}

function createDocument(channel, name, arr, model, createObj, afterSaveFunc = null) {
  model.create(createObj, function (err, result) {
    if (err)
      handleError(`Error creating ${name}.`);
    else {
      arr.push(result);
      if (afterSaveFunc) afterSaveFunc(result);
      client.say(channel, `${name} saved!`);
    }
  });
}

function deleteDocument(channel, name, model, searchObj) {
  model.deleteOne(searchObj, function (err) {
    if (err) handleError(err);
    else client.say(channel, `${name} deleted.`);
  })
}

function updateDocument(channel, name, obj, prop, newVal, msg) {
  if (prop) obj[prop] = newVal;
  if (!msg) msg = `${name} updated.`;

  obj.save(function (err) {
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

  return function (...arr) {
    if (!onCooldown) {
      func.apply(thisArg, arr);
      onCooldown = true;
      setTimeout(function () {
        onCooldown = false;
      }, timeout);
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
  commandMap['!' + command] = function ({channel}) {
    client.say(channel, text);
  }
}

//#endregion Helper Functions




