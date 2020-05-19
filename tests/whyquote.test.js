/* eslint-disable no-undef */

const mongoose = require("mongoose");
const WhyQuoteModel = require("../src/js/models/whyquote");
const whyQuoteData = {
  text: "Test Quote",
  user_added: "test",
  date_added: Date.now(),
};

describe("Why Quote Model Test", () => {
  beforeAll(async () => {
    await mongoose.connect(
      global.__MONGO_URI__,
      { useNewUrlParser: true, useCreateIndex: true },
      (err) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }
      }
    );
  });

  it("create and save a why quote successfully", async () => {
    const whyQuote = new WhyQuoteModel.default(whyQuoteData);
    const savedWhyQuote = await whyQuote.save();

    expect(savedWhyQuote._id).toBeDefined();
    expect(savedWhyQuote.text).toBe(whyQuoteData.text);
    expect(savedWhyQuote.user_added).toBe(whyQuoteData.user_added);
    expect(savedWhyQuote.date_added.toString()).toBe(
      new Date(whyQuoteData.date_added).toString()
    );
  });

  it("create why quote without required field should fail", async () => {
    const whyQuote = new WhyQuoteModel.default({ user_added: "fail" });
    let err;
    try {
      const whyQuoteWithoutRequiredField = await whyQuote.save();
      err = whyQuoteWithoutRequiredField;
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
