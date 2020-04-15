/* eslint-disable no-unused-vars */
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
WhyQuoteModel.find(function(err, result) {
  loadChatElementCallback(err, result, 'whyQuotes');
});
CounterModel.findOne({ name: 'deaths' }, function(err, result) {
  loadChatElementCallback(err, result, 'deaths');
});
CounterModel.findOne({ name: 'boops' }, function(err, result) {
  loadChatElementCallback(err, result, 'boops');
});

const cooldownIncrementDeathCounter = createCooldownFunction(this,incrementDeathCounter,10000);
const cooldownIncrementBoopCounter = createCooldownFunction(this,incrementBoopCounter,10000);

const commandMap = {
  '!dice' : function(channel, tags, msg, arr) {
    const num = rollDice();
    client.say(channel, `You rolled a ${num}!`);
  },
  '!whybot' : function(channel, tags, msg, arr) {
    client.say(channel, `Why Troy, why would you let me write a bot???`);
  },
  '!whyme' : function(channel, tags, msg, arr) {
    client.say(channel, `Why @${tags.username}, why???`);
  },
  '!addquote' : function(channel, tags, msg, arr) {
    const quote = msg.slice(arr[0].length + 1);
    if(quote && quote !== '') {
      createDocument(channel, 'Quote', chatElements.whyQuotes, WhyQuoteModel, { text: quote, user_added: tags.username });
    }
  },
  '!quote' : function(channel, tags, msg, arr) {
    if(chatElements.whyQuotes.length > 0) {
      const quoteIndex = Math.floor(Math.random() * chatElements.whyQuotes.length);
      const quote = chatElements.whyQuotes[quoteIndex];
      client.say(channel, `"${quote.text}" - Added by @${quote.user_added} on ${quote.date_added.toLocaleDateString()}`);
    }
  },
  '!death' : function(channel, tags, msg, arr) {
    cooldownIncrementDeathCounter(channel, tags, msg, arr);
  },
  '!setdeaths' : function(channel, tags, msg, arr) {
    setCounter(channel, tags, arr, 'deaths');
  },
  '!boop' : function(channel, tags, msg, arr) {
    cooldownIncrementBoopCounter(channel, tags, msg, arr);
  },
  '!resetboops' : function(channel, tags, msg, arr) {
    setCounter(channel, tags, arr, 'boops', 0);
  },
  '!boopboard' : function(channel, tags, msg, arr) {
    
  }
}

//#endregion Chat interaction

//#region Command functions

function rollDice () {
  const sides = 6;
  return Math.floor(Math.random() * sides) + 1;
}

function incrementDeathCounter(channel, tags, msg, arr) {
  if (chatElements.deaths) {
    chatElements.deaths.count++;
    chatElements.deaths.save(function (err) {
      if (err) handleError(err);
      client.say(channel, `Troy has died embarrassingly ${chatElements.deaths.count} times on stream!`);
    })
  }
}

function incrementBoopCounter(channel, tags, msg, arr) {
  if (chatElements.boops) {
    chatElements.boops.count++;

    let user = chatElements.boops.scoreboard.find(x => x.userName = tags.username);
    if (user) user.count = user.count + 1;
    else chatElements.boops.scoreboard.push({ user: tags.username, count: 1 });

    chatElements.boops.save(function (err) {
      if (err) handleError(err);
      client.say(channel, `@${tags.username} booped the snoot! The snoot has been booped ${chatElements.boops.count} times.`);
    })
  }
}

function setCounter(channel, tags, arr, counterName, count = NaN) {
  if(chatElements[counterName] && isModerator(tags.badges)) {
    let num = 0;
    if(count) num = count;
    else if (arr.length > 1) num = _.toInteger(arr[1]);

    if(!_.isInteger(num)) num = 0;
    chatElements[counterName].count = num;

    chatElements[counterName].save(function(err) {
      if(err) handleError(err);
      client.say(channel, `${_.upperFirst(counterName)} set to ${num}.`);
    })
  }
}

//#endregion Command functions

//#region Event Handlers

function onMessageHandler (channel, tags, msg, self) {
  if (self) { return; } // Ignore messages from the bot

  // Remove whitespace from chat message
  const trimmedMsg = msg.trim();
  const arr = trimmedMsg.split(' ');
  const commandName = arr[0];

  // If the command is known, let's execute it
  const command = commandMap[commandName];

  if(command) {
    command(channel, tags, trimmedMsg, arr);
    console.log(`* Executed ${commandName} command`);
  }
}

function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

//#endregion Event Handlers

//#region Helper Functions

function loadChatElementCallback(err, result, propName) {
  const err_msg = `Error loading ${propName}.`;
  const succ_msg = `Successfully loaded ${propName}!`;

  if(err) handleError(err_msg);
  else if(result) {
    chatElements[propName] = result;
    console.log(succ_msg);
  }
}

function createDocument(channel, name, arr, model, createObj) {
  model.create(createObj, function (err, result) {
    if (err)
      handleError(`Error creating ${name}.`);
    else {
      arr.push(result);
      client.say(channel, `${name} saved!`);
    }
  });
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

//#endregion Helper Functions




