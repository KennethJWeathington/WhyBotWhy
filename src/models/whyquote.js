const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const WhyQuoteSchema = new Schema(
  {
    text: {type: String, required: true, max: 100},
    user_added: String,
    date_added: {type: Date, default: Date.now()}
  }
);

//Export model
module.exports = mongoose.model('WhyQuote', WhyQuoteSchema);
