import { Client, Options, client, Userstate, Badges } from 'tmi.js';

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

/**
 * Returns whether the badges of a user allows them to access moderator actions.
 * @param {Array} badges Array of badges for a given user in Twitch Chat.
 */
function isModerator(badges: Badges) {
  return badges && !!(badges.broadcaster || badges.moderator);
}

const chatClient: Client = client(opts);

export { chatClient, Userstate, isModerator };
