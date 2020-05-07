import * as mongoose from "mongoose";

const SimpleTextCommandSchema = new mongoose.Schema({
  command: { type: String, required: true, max: 100 },
  text: { type: String, required: true, max: 500 },
});

export interface ISimpleTextCommand extends mongoose.Document {
  command: string;
  text: string;
}

export default mongoose.model<ISimpleTextCommand>(
  "SimpleTextCommand",
  SimpleTextCommandSchema
);
