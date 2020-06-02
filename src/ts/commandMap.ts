import WhyQuoteModel, { IWhyQuote } from './models/whyquote';
import CounterModel, { ICounter, CounterScoreboard } from './models/counter';
import SimpleTextCommandModel, {
  ISimpleTextCommand,
} from './models/simpletextcommand';
import * as _ from 'lodash';
import {
  createDocument,
  deleteDocument,
  updateDocument,
  loadDocument,
  loadDocuments,
} from './databaseHelper';
import { Messages, AssembleTemplatedString } from './commandMessages';
import * as request from 'request';

const cooldown = Number.parseInt(process.env.COMMAND_TIMEOUT);
const rulesInterval = Number.parseInt(process.env.RULES_TIMEOUT);

class CommandArguments {
  constructor(
    public userName: string,
    public msg: string,
    public msgArray: string[],
    public isModerator: boolean
  ) {}
}

class Command {
  constructor(
    public command: (args: CommandArguments) => string,
    public mod_required: boolean
  ) {}
}

class ChatElements {
  whyQuotes: IWhyQuote[];
  simpleTextCommands: ISimpleTextCommand[];
  boops: ICounter;
  deaths: ICounter;
}

const chatElements = new ChatElements();

const cooldownDeathCounter = createCooldownCommand(
  this,
  incrementDeathCounter,
  cooldown
);
const cooldownBoopCounter = createCooldownCommand(
  this,
  incrementBoopCounter,
  cooldown
);

const commandMap = new Map<string, Command>();
commandMap.set(
  '!whyme',
  new Command(
    (args: CommandArguments) =>
      AssembleTemplatedString(Messages.WHY, { name: args.userName }),
    false
  )
);
commandMap.set('!addquote', new Command(addQuote, false));
commandMap.set('!quote', new Command(getRandomQuote, false));
commandMap.set('!death', new Command(cooldownDeathCounter, false));
commandMap.set(
  '!setdeaths',
  new Command(
    (args: CommandArguments) => setCounter(args, chatElements.deaths),
    true
  )
);
commandMap.set('!boop', new Command(cooldownBoopCounter, false));
commandMap.set('!boopboard', new Command(showBoopBoard, false));
commandMap.set('!addcommand', new Command(addCommand, true));
commandMap.set('!removecommand', new Command(removeCommand, true));
commandMap.set('!rules', new Command(showRules, false));
commandMap.set('!commands', new Command(showCommands, false));
commandMap.set('!followage', new Command(showFollowage, false));

async function setupCommands() {
  const whyQuotePromise = loadDocuments(WhyQuoteModel, {});
  const deathsPromise = loadDocument(CounterModel, { name: 'deaths' });
  const boopsPromise = loadDocument(CounterModel, { name: 'boops' });
  const simpleTextCommandPromise = loadDocuments(SimpleTextCommandModel, {});

  const whyQuotes = await whyQuotePromise;
  chatElements.whyQuotes = whyQuotes || [];
  const deaths = await deathsPromise;
  chatElements.deaths = deaths;
  const boops = await boopsPromise;
  chatElements.boops = boops;
  const simpleTextCommands = await simpleTextCommandPromise;
  chatElements.simpleTextCommands = simpleTextCommands || [];

  chatElements.simpleTextCommands.forEach((element) =>
    addSimpleTextCommandToMap(element.command, element.text)
  );
}

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
  quote &&
    createDocument(WhyQuoteModel, {
      text: quote.replace(/\/|\\/g, ''),
      user_added: args.userName,
    });

  return `Quote saved!`;
}

/**
 * Sends a random WhyQuote to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function getRandomQuote(args: CommandArguments) {
  const quoteIndex = Math.floor(Math.random() * chatElements.whyQuotes.length);
  const quote = chatElements.whyQuotes[quoteIndex];
  return quote
    ? AssembleTemplatedString(Messages.QUOTE, {
        quote: quote.text,
        name: quote.user_added,
        date: quote.date_added.toLocaleDateString(),
      })
    : Messages.NO_QUOTES;
}

/**
 * Increments the death counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementDeathCounter(args: CommandArguments) {
  incrementCounter(args, chatElements.deaths, false);

  return AssembleTemplatedString(Messages.DEATH, {
    name: process.env.STREAMER_NAME,
    count: chatElements.deaths.count,
  });
}

/**
 * Increments the boop counter and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function incrementBoopCounter(args: CommandArguments) {
  incrementCounter(args, chatElements.boops, true);

  return AssembleTemplatedString(Messages.BOOP, {
    name: args.userName,
    count: chatElements.boops.count,
  });
}

function incrementCounter(
  args: CommandArguments,
  counter: ICounter,
  trackScoreboard: boolean
) {
  counter.count++;

  if (trackScoreboard) {
    const user = counter.scoreboard.find((x) => (x.user = args.userName));

    if (user) user.count++;
    else counter.scoreboard.push(new CounterScoreboard(args.userName, 1));

    counter.scoreboard = counter.scoreboard.sort((a, b) => b.count - a.count);
  }
  updateDocument(counter);
}

/**
 * Assembles the boop leaderboard showing the users with the top 3 boop counts and sends a message with the results to Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showBoopBoard(args: CommandArguments) {
  let scoreboardMessage = Messages.BOOP_LEADERBOARD;

  for (let i = 0; i < chatElements.boops.scoreboard.length && i < 3; i++) {
    const score = chatElements.boops.scoreboard[i];
    scoreboardMessage =
      scoreboardMessage +
      AssembleTemplatedString(Messages.BOOP_PLACEMENT, {
        placement: i + 1,
        name: score.user,
        score: score.count,
      });
  }

  return _.trimEnd(scoreboardMessage, ',');
}

/**
 * Adds a command to the SimpleTextCommand collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {string} msg The message received from a Twitch chat channel.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
function addCommand(args: CommandArguments) {
  if (args.isModerator && args.msgArray.length > 2) {
    const commandKeyword = _.toLower(args.msgArray[1]);
    let msg = Messages.COMMAND_EXISTS;

    if (!commandMap.has(`!${commandKeyword}`)) {
      const commandText = args.msg
        .slice(args.msgArray[0].length + commandKeyword.length + 2)
        .replace(/\/|\\/g, '');

      createDocument(SimpleTextCommandModel, {
        command: commandKeyword,
        text: commandText,
      }).then((result) => {
        chatElements.simpleTextCommands.push(result);
        addSimpleTextCommandToMap(result.command, result.text);
        msg = AssembleTemplatedString(Messages.COMMAND_ADDED, {
          command: commandKeyword,
        });
      });
    }

    return msg;
  }
}

/**
 * Removes a command to the SimpleTextCommand collection.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 */
function removeCommand(args: CommandArguments) {
  let msg: string;

  if (args.isModerator && args.msgArray.length > 1) {
    const removedCommands = _.remove(
      chatElements.simpleTextCommands,
      (x) => x.command === _.toLower(args.msgArray[1])
    );

    if (removedCommands.length > 0) {
      const element = removedCommands[0];
      const fullCommand = `!${element.command}`;

      commandMap.delete(fullCommand);
      deleteDocument(SimpleTextCommandModel, { command: element.command });

      let msg = Messages.COMMAND_DELETED;
    } else msg = Messages.COMMAND_NOT_FOUND;
  }

  return msg;
}

/**
 * Sends a message containing the channel rules into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showRules() {
  return Messages.RULES;
}

/**
 * Sends a message containing non-moderator commands into Twitch Chat.
 * @param {string} channel The Twitch channel to send any messages to.
 */
function showCommands(args: CommandArguments) {
  let commandMsg = 'Commands: ';
  commandMap.forEach((value, key) => {
    if (!value.mod_required) commandMsg += `${key} `;
  });

  return _.trimEnd(commandMsg);
}

/**
 * Sends a message in Twitch Chat which contains how long the user has been following the channel.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {Tags} tags The Tags object from a Twitch message.
 */
function showFollowage(args: CommandArguments) {
  let msg: string;
  request(
    `https://api.2g.be/twitch/followage/${process.env.CHANNEL_NAME}/${args.userName}?format=mwdhms`,
    (error, response, body) => {
      if (response && response.statusCode === 200) msg = `@${body}`;
    }
  );

  return msg;
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
function setCounter(
  args: CommandArguments,
  counter: ICounter,
  count: number = NaN
) {
  let msg: string;
  if (args.isModerator) {
    let num = 0;

    if (args.msgArray.length > 1) num = _.toInteger(args.msgArray[1]);
    num = count && num;
    if (!_.isInteger(num)) num = 0;

    counter.count = num;
    updateDocument(counter);
    msg = AssembleTemplatedString(Messages.COUNTER_SET, {
      counter: _.upperFirst(counter.name),
      count: num,
    });
  }

  return msg;
}

/**
 * Adds a simple text command to the command map.
 * @param {string} command The keyword that will invoke the command.
 * @param {string} text The text that will display with the command is invoked.
 */
function addSimpleTextCommandToMap(command: string, text: string) {
  commandMap.set(
    '!' + command,
    new Command((args: CommandArguments) => text, false)
  );
}

/**
 * Create a modified function that will prevent subsequent executions until a timer(cooldown) runs out.
 * @param {this} thisArg Context to execute the function in.
 * @param {Function} func Function to execute on a cooldown.
 * @param {number} timeout Length of the cooldown.
 * @returns {Function} A modified function with a cooldown that prevents rapid execution.
 */
function createCooldownCommand(
  thisArg,
  func: (args: CommandArguments) => string,
  timeout: number
) {
  let onCooldown = false;

  return (args: CommandArguments) => {
    let msg: string;
    if (!onCooldown) {
      msg = func.call(thisArg, args);
      onCooldown = true;
      setTimeout(() => (onCooldown = false), timeout);
    }
    return msg;
  };
}

const IntervalCommands = [{ command: showRules, interval: rulesInterval }];

export { commandMap, CommandArguments, setupCommands, IntervalCommands };
