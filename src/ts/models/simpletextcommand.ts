const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const SimpleTextCommandSchema = new Schema(
  {
    command: {type: String, required: true, max: 100},
    text: {type: String, required: true, max: 500}
  }
);

//Export model
module.exports = mongoose.model('SimpleTextCommand', SimpleTextCommandSchema);
