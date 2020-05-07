import * as mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, max: 100 },
  count: { type: Number, required: true, default: 0 },
  scoreboard: [{ user: String, count: Number }],
});

export class CounterScoreboard {
  constructor(public user: string, public count: number) {
    this.user = user;
    this.count = count;
  }
}

export interface ICounter extends mongoose.Document {
  name: string;
  count: number;
  scoreboard: CounterScoreboard[];
}

export default mongoose.model<ICounter>("Counter", CounterSchema);
