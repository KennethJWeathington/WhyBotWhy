"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const CounterSchema = new mongoose.Schema({
    name: { type: String, required: true, max: 100 },
    count: { type: Number, required: true, default: 0 },
    scoreboard: [{ user: String, count: Number }],
});
class CounterScoreboard {
    constructor(user, count) {
        this.user = user;
        this.count = count;
        this.user = user;
        this.count = count;
    }
}
exports.CounterScoreboard = CounterScoreboard;
exports.default = mongoose.model('Counter', CounterSchema);
