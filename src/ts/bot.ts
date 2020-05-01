//#region Imports

import * as dotenv from 'dotenv';
import * as tmi from 'tmi.js';
import * as _ from 'lodash';
import * as mongoose from 'mongoose';
import * as request from 'request';
import WhyQuoteModel, { IWhyQuote } from './models/whyquote';
import CounterModel, { ICounter, CounterScoreboard } from './models/counter';
import SimpleTextCommandModel, { ISimpleTextCommand } from './models/simpletextcommand';

dotenv.config();

//#endregion Imports

//#region Mongoose

const mongoDB = process.env.DB_CONN_STRING;
mongoose.connect(mongoDB, { useNewUrlParser: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

//#endregion Mongoose

//#region Environment Variable Parsing

const showDebug = _.toLower(process.env.SHOW_IRC_DEBUG_INFO) === 'true';
const cooldown = Number.parseInt(process.env.COMMAND_TIMEOUT);
const rulesInterval = Number.parseInt(process.env.RULES_TIMEOUT);

//#endregion Environment Variable Parsing

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

//#region Class Declarations

class ChatElements {
  whyQuotes: IWhyQuote[];
  simpleTextCommands: ISimpleTextCommand[];
  boops: ICounter;
  deaths: ICounter;
}

class CommandArguments {
  constructor(public channel: string, public userState: tmi.Userstate, public msg: string, public msgArray: string[]) { }
}

class Command {
  constructor(public command: (args: CommandArguments) => void, public mod_required: boolean) { }
}

//#endregion Class Declarations

//#region Chat interaction

const chatElements = new ChatElements();

const cooldownDeathCounter = createCooldownCommand(this, incrementDeathCounter, cooldown);
const cooldownBoopCounter = createCooldownCommand(this, incrementBoopCounter, cooldown);

const commandMap = new Map<string, Command>();
commandMap.set('!whyme', new Command((args: CommandArguments) => client.say(args.channel, `Why @${args.userState.username}, why???`), false));
commandMap.set('!addquote', new Command(addQuote, false));
commandMap.set('!quote', new Command(getQuote, false));
commandMap.set('!death', new Command(cooldownDeathCounter, false));
commandMap.set('!setdeaths', new Command((args: CommandArguments) => setCounter(args, 'deaths'), true));
commandMap.set('!boop', new Command(cooldownBoopCounter, false));
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
function addQuote(args: CommandArguments) {
  const quote = args.msg.slice(args.msgArray[0].length + 1);
  if (quote)
    createDocument(args.channel, 'Quote', chatElements.whyQuotes, WhyQuoteModel, { text: quote.replace(/\/|\\/g,''), user_added: args.userState.username });
}

/**
 * Sends a random WhyQuote to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function getQuote(args: CommandArguments) {
  if (chatElements.whyQuotes.length > 0) {
    const quoteIndex = Math.floor(Math.random() * chatElements.whyQuotes.length);
    const quote = chatElements.whyQuotes[quoteIndex];
    client.say(args.channel, `"${quote.text}" - Added by @${quote.user_added} on ${quote.date_added.toLocaleDateString()}`);
  }
}

/**
 * Increments the death counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementDeathCounter(args: CommandArguments) {
  incrementCounter(args, chatElements.deaths, `${process.env.STREAMER_NAME} has died embarrassingly {count} times on stream!`,false);
}

/**
 * Increments the boop counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementBoopCounter(args: CommandArguments) {
  incrementCounter(args, chatElements.boops, `@${args.userState.username} booped the snoot! The snoot has been booped {count} times.`, true);
}

function incrementCounter(args: CommandArguments, counter: ICounter, updateMsg: string, trackScoreboard: boolean) {
  counter.count++;

  if(trackScoreboard) {
    const user = counter.scoreboard.find(x => x.user = args.userState.username);
    
    if (user) user.count++;
    else counter.scoreboard.push(new CounterScoreboard(args.userState.username, 1));

    counter.scoreboard = counter.scoreboard.sort((a, b) => b.count - a.count);
  }
  updateDocument(args.channel, null, counter, null, null, updateMsg.replace('{count}',counter.count.toString()));
}

/**
 * Assembles the boop leaderboard showing the users with the top 3 boop counts and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showBoopBoard(args: CommandArguments) {
  let scoreboardMessage = 'Top Boopers:'

  for (let i = 0; i < chatElements.boops.scoreboard.length && i < 3; i++) {
    const score = chatElements.boops.scoreboard[i];
    scoreboardMessage = scoreboardMessage + ` ${i + 1}. @${score.user}: ${score.count} boops,`;
  }
  client.say(args.channel, _.trimEnd(scoreboardMessage, ','));
}

/**
 * Adds a command to the SimpleTextCommand collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
async function addCommand(args: CommandArguments) {
  if (isModerator(args.userState.badges) && args.msgArray.length > 2) {
    const commandKeyword = _.toLower(args.msgArray[1]);

    if (commandMap.has(`!${commandKeyword}`))
      client.say(args.channel, 'Command already exists.');
    else {
      const commandText = args.msg.slice(args.msgArray[0].length + commandKeyword.length + 2).replace(/\/|\\/g, '');

      const result = await createDocument(args.channel, `Command !${commandKeyword}`, chatElements.simpleTextCommands, SimpleTextCommandModel,
        { command: commandKeyword, text: commandText });
      addSimpleTextCommandToMap(result.command, result.text);
    }
  }
}

/**
 * Removes a command to the SimpleTextCommand collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
function removeCommand(args: CommandArguments) {
  if (isModerator(args.userState.badges) && args.msgArray.length > 1) {
    const removedCommands = _.remove(chatElements.simpleTextCommands, x => x.command === _.toLower(args.msgArray[1]));

    if (removedCommands.length > 0) {
      removedCommands.forEach(element => {
        const fullCommand = `!${element.command}`;
        commandMap.delete(fullCommand);
        deleteDocument(args.channel, `Command ${fullCommand}`, SimpleTextCommandModel, { command: element.command });
      });
    } else { client.say(args.channel, 'Command not found.'); }
  }
}

/**
 * Sends a message containing the channel rules into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showRules(args: CommandArguments) {
  client.say(args.channel,process.env.RULES_COMMAND_TEXT);
}

/**
 * Sends a message containing non-moderator commands into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showCommands(args: CommandArguments) {
  let commandMsg = 'Commands: '
  commandMap.forEach((value, key) => { if (!value.mod_required) commandMsg += `${key} `; })

  client.say(args.channel, _.trimEnd(commandMsg));
}

/**
 * Sends a message in Twitch Chat which contains how long the user has been following the channel.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 */
function showFollowage(args: CommandArguments) {
  request(`https://api.2g.be/twitch/followage/${process.env.CHANNEL_NAME}/${args.userState.username}?format=mwdhms`,(error, response, body) => {
    if(error) handleError(error);
    if(response && response.statusCode === 200)
      client.say(args.channel, `@${body}`);
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
 * @param {tmi.Userstate} userState The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {boolean} self Whether the received message was from this bot or not.
 */
function onMessageHandler(channel: string, userState: tmi.Userstate, msg: string, self: boolean) {
  if (self || userState['message-type'] != 'chat') return;

  const trimmedMsg = msg.trim();
  const arr = trimmedMsg.split(' ');
  const commandName = _.toLower(arr[0]);

  const commandElement = commandMap.get(commandName);
  if (commandElement)
    commandElement.command(new CommandArguments(channel, userState, trimmedMsg, arr));
}

/**
 * Handler for subscription event of connection to Twitch Chat. Used to respond to subscriptions.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} username The username of the subscriber.
 */
function onSubscriptionHandler(channel: string, username: string) {
  client.say(channel, `Thank you for the subscription @${username}! Enjoy your stay.`);
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
    loadChatElement(SimpleTextCommandModel, {}, 'simpleTextCommands', false, [])
  ]

  await Promise.all(promArray).catch(err => handleError(err));
  chatElements.simpleTextCommands.forEach(element => addSimpleTextCommandToMap(element.command, element.text));
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
async function loadChatElement<T extends mongoose.Document>(model: mongoose.Model<T>, findObj: {}, name: string, loadOne: boolean, def: any = null) {
  let promise: Promise<T> | Promise<T[]>;
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
async function createDocument<T extends mongoose.Document>(channel: string, name: string, arr: T[], model: mongoose.Model<T>, createObj: {}) {
  const promise = model.create(createObj);
  
  const result = await promise;
  arr.push(result);
  client.say(channel, `${name} saved!`);

  return promise;
}

/**
 * Deleted documents matching the search criteria from the specified Collection of Documents.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document deletes.
 * @param {model} model Model of schema of document to delete.
 * @param {Object} searchObj Search criteria to limit deletion of documents.
 */
async function deleteDocument<T extends mongoose.Document>(channel: string, name: string, model: mongoose.Model<T>, searchObj: {}) {
  await model.deleteOne(searchObj).exec()
  client.say(channel, `${name} deleted.`);
}

/**
 * Updates a property on a document object if specified, then saves the document object.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document updates.
 * @param {Object} obj Object to update.
 * @param {string} [propName] Property on obj to update.
 * @param {*} [newVal] New value to set to prop.
 * @param {string} [msg] Message to display in chat after document updates.
 */
async function updateDocument<T extends mongoose.Document>(channel: string, name: string, obj: T, propName: string, newVal: any, msg: string) {
  if (propName) obj[propName] = newVal;
  if (!msg) msg = `${name} updated.`;

  await obj.save();
  client.say(channel, msg);
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
  // return badges && (_.has(badges, 'broadcaster') || _.has(badges, 'moderator'));
  return badges && (badges.broadcaster || badges.moderator)
}

/**
 * Create a modified function that will prevent subsequent executions until a timer(cooldown) runs out.
 * @param {this} thisArg Context to execute the function in.
 * @param {Function} func Function to execute on a cooldown.
 * @param {number} timeout Length of the cooldown.
 * @returns {Function} A modified function with a cooldown that prevents rapid execution.
 */
function createCooldownCommand(thisArg, func: (args: CommandArguments) => void, timeout: number) {
  let onCooldown = false;

  return (args: CommandArguments) => {
    if (!onCooldown) {
      func.call(thisArg, args);
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
function setCounter(args: CommandArguments, counterName: string, count: number = NaN) {
  if (chatElements[counterName] && isModerator(args.userState.badges)) {
    let num = 0;
    if (count) num = count;
    else if (args.msgArray.length > 1) num = _.toInteger(args.msgArray[1]);
    
    if (!_.isInteger(num)) num = 0;
    updateDocument(args.channel, null, chatElements[counterName], 'count', num, `${_.upperFirst(counterName)} set to ${num}.`)
  }
}

/**
 * Adds a simple text command to the command map.
 * @param {string} command The keyword that will invoke the command.
 * @param {string} text The text that will display with the command is invoked.
 */
function addSimpleTextCommandToMap(command: string, text: string) {
  commandMap.set('!' + command, new Command((args: CommandArguments) => client.say(args.channel, text), false ));
}

//#endregion Helper Functions




