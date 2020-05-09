import { Client, Options, client, Userstate } from 'tmi.js';

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

export { chatClient, Userstate };
