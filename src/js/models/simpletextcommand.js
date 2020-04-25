"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const SimpleTextCommandSchema = new mongoose.Schema({
    command: { type: String, required: true, max: 100 },
    text: { type: String, required: true, max: 500 }
});
exports.default = mongoose.model('SimpleTextCommand', SimpleTextCommandSchema);
