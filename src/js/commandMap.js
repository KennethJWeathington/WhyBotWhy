"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const whyquote_1 = require("./models/whyquote");
const counter_1 = require("./models/counter");
const simpletextcommand_1 = require("./models/simpletextcommand");
const _ = require("lodash");
const databaseHelper_1 = require("./databaseHelper");
const request = require("request");
const cooldown = Number.parseInt(process.env.COMMAND_TIMEOUT);
const rulesInterval = Number.parseInt(process.env.RULES_TIMEOUT);
class CommandArguments {
    constructor(channel, userName, msg, msgArray, isModerator) {
        this.channel = channel;
        this.userName = userName;
        this.msg = msg;
        this.msgArray = msgArray;
        this.isModerator = isModerator;
    }
}
exports.CommandArguments = CommandArguments;
class Command {
    constructor(command, mod_required) {
        this.command = command;
        this.mod_required = mod_required;
    }
}
class ChatElements {
}
const chatElements = new ChatElements();
const cooldownDeathCounter = createCooldownCommand(this, incrementDeathCounter, cooldown);
const cooldownBoopCounter = createCooldownCommand(this, incrementBoopCounter, cooldown);
const commandMap = new Map();
exports.commandMap = commandMap;
commandMap.set('!whyme', new Command((args) => chatClient.say(args.channel, `Why @${args.userState.username}, why???`), false));
commandMap.set('!addquote', new Command(addQuote, false));
commandMap.set('!quote', new Command(getQuote, false));
commandMap.set('!death', new Command(cooldownDeathCounter, false));
commandMap.set('!setdeaths', new Command((args) => setCounter(args, 'deaths'), true));
commandMap.set('!boop', new Command(cooldownBoopCounter, false));
commandMap.set('!boopboard', new Command(showBoopBoard, false));
commandMap.set('!addcommand', new Command(addCommand, true));
commandMap.set('!removecommand', new Command(removeCommand, true));
commandMap.set('!rules', new Command(showRules, false));
commandMap.set('!commands', new Command(showCommands, false));
commandMap.set('!followage', new Command(showFollowage, false));
//#region Command functions
/**
 * Adds a quote to the WhyQuote collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
function addQuote(args) {
    const quote = args.msg.slice(args.msgArray[0].length + 1);
    if (quote)
        databaseHelper_1.createDocument(args.channel, 'Quote', chatElements.whyQuotes, whyquote_1.default, { text: quote.replace(/\/|\\/g, ''), user_added: args.userState.username });
}
/**
 * Sends a random WhyQuote to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function getQuote(args) {
    if (chatElements.whyQuotes.length > 0) {
        const quoteIndex = Math.floor(Math.random() * chatElements.whyQuotes.length);
        const quote = chatElements.whyQuotes[quoteIndex];
        chatClient.say(args.channel, `"${quote.text}" - Added by @${quote.user_added} on ${quote.date_added.toLocaleDateString()}`);
    }
}
/**
 * Increments the death counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementDeathCounter(args) {
    incrementCounter(args, chatElements.deaths, `${process.env.STREAMER_NAME} has died embarrassingly {count} times on stream!`, false);
}
/**
 * Increments the boop counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementBoopCounter(args) {
    incrementCounter(args, chatElements.boops, `@${args.userState.username} booped the snoot! The snoot has been booped {count} times.`, true);
}
function incrementCounter(args, counter, updateMsg, trackScoreboard) {
    counter.count++;
    if (trackScoreboard) {
        const user = counter.scoreboard.find((x) => (x.user = args.userState.username));
        if (user)
            user.count++;
        else
            counter.scoreboard.push(new counter_1.CounterScoreboard(args.userState.username, 1));
        counter.scoreboard = counter.scoreboard.sort((a, b) => b.count - a.count);
    }
    databaseHelper_1.updateDocument(args.channel, null, counter, null, null, updateMsg.replace('{count}', counter.count.toString()));
}
/**
 * Assembles the boop leaderboard showing the users with the top 3 boop counts and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showBoopBoard(args) {
    let scoreboardMessage = 'Top Boopers:';
    for (let i = 0; i < chatElements.boops.scoreboard.length && i < 3; i++) {
        const score = chatElements.boops.scoreboard[i];
        scoreboardMessage =
            scoreboardMessage + ` ${i + 1}. @${score.user}: ${score.count} boops,`;
    }
    chatClient.say(args.channel, _.trimEnd(scoreboardMessage, ','));
}
/**
 * Adds a command to the SimpleTextCommand collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
async function addCommand(args) {
    if (isModerator(args.userState.badges) && args.msgArray.length > 2) {
        const commandKeyword = _.toLower(args.msgArray[1]);
        if (commandMap.has(`!${commandKeyword}`))
            chatClient.say(args.channel, 'Command already exists.');
        else {
            const commandText = args.msg
                .slice(args.msgArray[0].length + commandKeyword.length + 2)
                .replace(/\/|\\/g, '');
            const result = await databaseHelper_1.createDocument(args.channel, `Command !${commandKeyword}`, chatElements.simpleTextCommands, simpletextcommand_1.default, { command: commandKeyword, text: commandText });
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
function removeCommand(args) {
    if (isModerator(args.userState.badges) && args.msgArray.length > 1) {
        const removedCommands = _.remove(chatElements.simpleTextCommands, (x) => x.command === _.toLower(args.msgArray[1]));
        if (removedCommands.length > 0) {
            removedCommands.forEach((element) => {
                const fullCommand = `!${element.command}`;
                commandMap.delete(fullCommand);
                databaseHelper_1.deleteDocument(args.channel, `Command ${fullCommand}`, simpletextcommand_1.default, { command: element.command });
            });
        }
        else {
            chatClient.say(args.channel, 'Command not found.');
        }
    }
}
/**
 * Sends a message containing the channel rules into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showRules(args) {
    chatClient.say(args.channel, process.env.RULES_COMMAND_TEXT);
}
/**
 * Sends a message containing non-moderator commands into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showCommands(args) {
    let commandMsg = 'Commands: ';
    commandMap.forEach((value, key) => {
        if (!value.mod_required)
            commandMsg += `${key} `;
    });
    chatClient.say(args.channel, _.trimEnd(commandMsg));
}
/**
 * Sends a message in Twitch Chat which contains how long the user has been following the channel.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 */
function showFollowage(args) {
    request(`https://api.2g.be/twitch/followage/${process.env.CHANNEL_NAME}/${args.userState.username}?format=mwdhms`, (error, response, body) => {
        if (error)
            handleError(error);
        if (response && response.statusCode === 200)
            chatClient.say(args.channel, `@${body}`);
    });
}
function startIntervals() {
    const rulesIntervals = [];
    const channels = chatClient.getChannels();
    channels.forEach((channel) => rulesIntervals.push(setInterval(showRules, rulesInterval, { channel })));
}
//#endregion Command functions
/**
 * A moderator-only function to set a counter to specified number.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 * @param {string} counterName Name of the counter to modify.
 * @param {number} count Count to set the counter to.
 */
function setCounter(args, counterName, count = NaN) {
    if (chatElements[counterName] && isModerator(args.userState.badges)) {
        let num = 0;
        if (count)
            num = count;
        else if (args.msgArray.length > 1)
            num = _.toInteger(args.msgArray[1]);
        if (!_.isInteger(num))
            num = 0;
        databaseHelper_1.updateDocument(args.channel, null, chatElements[counterName], 'count', num, `${_.upperFirst(counterName)} set to ${num}.`);
    }
}
/**
 * Adds a simple text command to the command map.
 * @param {string} command The keyword that will invoke the command.
 * @param {string} text The text that will display with the command is invoked.
 */
function addSimpleTextCommandToMap(command, text) {
    commandMap.set('!' + command, new Command((args) => chatClient.say(args.channel, text), false));
}
/**
 * Create a modified function that will prevent subsequent executions until a timer(cooldown) runs out.
 * @param {this} thisArg Context to execute the function in.
 * @param {Function} func Function to execute on a cooldown.
 * @param {number} timeout Length of the cooldown.
 * @returns {Function} A modified function with a cooldown that prevents rapid execution.
 */
function createCooldownCommand(thisArg, func, timeout) {
    let onCooldown = false;
    return (args) => {
        if (!onCooldown) {
            func.call(thisArg, args);
            onCooldown = true;
            setTimeout(() => (onCooldown = false), timeout);
        }
    };
}
