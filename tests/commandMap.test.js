/* eslint-disable no-undef */
const dotenv = require('dotenv');
dotenv.config();
const commandMap = require('../src/js/commandMap');

describe('Command Map Test', () => {
  // beforeAll(async () => {
  //   await mongoose.connect(
  //     global.__MONGO_URI__,
  //     { useNewUrlParser: true, useCreateIndex: true },
  //     (err) => {
  //       if (err) {
  //         console.error(err);
  //         process.exit(1);
  //       }
  //     }
  //   );
  // });

  it('executes rules command', () => {
    const rulesText = commandMap.commandMap['!rules'].command();
    expect(rulesText).toBe(process.env.RULES_COMMAND_TEXT);
  });

  // afterAll(() => {
  //   mongoose.disconnect();
  // });
});
