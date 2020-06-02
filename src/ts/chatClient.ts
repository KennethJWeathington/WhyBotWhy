import { Client, Options, client, Userstate, Badges } from 'tmi.js';

interface MessageHandler {
  (message: string, userName: string, isModerator: boolean): string;
}

interface SubscriptionHandler {
  (userName: string): string;
}

const showDebug = process.env.SHOW_IRC_DEBUG_INFO.toLowerCase() === 'true';
const opts: Options = {
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN,
  },
  channels: [process.env.CHANNEL_NAME],
  connection: {
    reconnect: true,
    secure: true,
  },
  options: {
    debug: showDebug,
  },
};

const chatClient: Client = client(opts);
let messageHandler: MessageHandler;
let subscriptionHandler: SubscriptionHandler;

/**
 * Returns whether the badges of a user allows them to access moderator actions.
 * @param {Array} badges Array of badges for a given user in Twitch Chat.
 */
function isModerator(badges: Badges) {
  return badges && !!(badges.broadcaster || badges.moderator);
}

function onMessageHandler(
  channel: string,
  userState: Userstate,
  msg: string,
  self: boolean
) {
  if (self || userState['message-type'] != 'chat') return;

  const message = messageHandler(
    msg,
    userState.username,
    isModerator(userState.badges)
  );

  if (message)
    for (const channel of chatClient.getChannels())
      chatClient.say(channel, message);
}

function setMessageHandler(handler: MessageHandler) {
  messageHandler = handler;
  chatClient.on('message', onMessageHandler);
}

function onSubscriptionHandler(channel: string, username: string) {
  chatClient.say(channel, subscriptionHandler(username));
}

function setSubscriberHandler(handler: SubscriptionHandler) {
  subscriptionHandler = handler;
  chatClient.on('subscription', onSubscriptionHandler);
}

export { setMessageHandler };
