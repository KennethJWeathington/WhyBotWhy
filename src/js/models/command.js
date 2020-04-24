const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const CommandSchema = new Schema({
    command_name: { type: String, required: true, max: 50 },
    command_text: { type: String, required: true, max: 100 }
});
//Export model
module.exports = mongoose.model('Command', CommandSchema);
