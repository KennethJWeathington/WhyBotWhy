"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const WhyQuoteSchema = new mongoose.Schema({
    text: { type: String, required: true, max: 100 },
    user_added: String,
    date_added: { type: Date, default: Date.now() }
});
exports.default = mongoose.model('WhyQuote', WhyQuoteSchema);
