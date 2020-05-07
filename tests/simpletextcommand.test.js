/* eslint-disable no-undef */

const mongoose = require('mongoose');
const SimpleTextCommandModel = require('../src/js/models/simpletextcommand');
const simpleTextCommandData = { command: "!test", text: "Test text" }

describe('Simple Text Command Test', () => {

  beforeAll(async () => {
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true, useCreateIndex: true }, (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  });

  it('create and save a simple text command successfully', async () => {
    const simpleTextCommand = new SimpleTextCommandModel.default(simpleTextCommandData);
    const savedSimpleTextCommand = await simpleTextCommand.save();

    expect(savedSimpleTextCommand._id).toBeDefined();
    expect(savedSimpleTextCommand.command).toBe(simpleTextCommandData.command);
    expect(savedSimpleTextCommand.text).toBe(simpleTextCommandData.text);
  });

  it('create simple text command without required field command should fail', async () => {
    const simpleTextCommand = new SimpleTextCommandModel.default({ text: "fail" });
    let err;
    try {
      const simpleTextCommandWithoutRequiredField = await simpleTextCommand.save();
      err = simpleTextCommandWithoutRequiredField;
    } catch (error) {
      err = error;
    }

    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.command).toBeDefined();
  });

  it('create simple text command without required field text should fail', async () => {
    const simpleTextCommand = new SimpleTextCommandModel.default({ command: "fail" });
    let err;
    try {
      const simpleTextCommandWithoutRequiredField = await simpleTextCommand.save();
      err = simpleTextCommandWithoutRequiredField;
    } catch (error) {
      err = error;
    }

    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.text).toBeDefined();
  });

  afterAll(() => {
    mongoose.disconnect();
  });
});

  //https://medium.com/javascript-in-plain-english/how-i-setup-unit-test-for-mongodb-using-jest-mongoose-103b772ee164