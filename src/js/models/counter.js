const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const CounterSchema = new Schema({
    name: { type: String, required: true, max: 100 },
    count: { type: Number, required: true, default: 0 },
    scoreboard: [{ user: String, count: Number }]
});
//Export model
module.exports = mongoose.model('Counter', CounterSchema);
