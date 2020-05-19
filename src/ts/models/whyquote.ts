import * as mongoose from 'mongoose';

const WhyQuoteSchema = new mongoose.Schema({
  text: { type: String, required: true, max: 100 },
  user_added: String,
  date_added: { type: Date, default: Date.now() },
});

export interface IWhyQuote extends mongoose.Document {
  text: string;
  user_added: string;
  date_added: Date;
}

export default mongoose.model<IWhyQuote>('WhyQuote', WhyQuoteSchema);
