//#region setup

require('dotenv').config()

const mongoose = require('mongoose');
const mongoDB = process.env.DB_CONN_STRING;
mongoose.connect(mongoDB, { useNewUrlParser: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

//#endregion setup

//#region metadata creation

const CounterModel = require('../models/counter');
const counterArr = ['deaths', 'boops']
for (let i = 0; i < counterArr.length; i++) {
  createModelIfNotExist(counterArr[i], CounterModel, {name:counterArr[i]}, {name: counterArr[i], count: 0, scoreboard: []});
}

//#endregion metadata creation

//#region helper functions

function createModelIfNotExist(name, model, srchObj, createObj) {
    model.findOne(srchObj, function(err, result) {
        callback(err, result, name, createObj);
    });
}

function callback(err, result, name, createObj) {
    const err_msg = `Error loading ${name}.`;
    const succ_msg = `Successfully created ${name}!`;
  
    if(err) handleError(err_msg);
    else if(!result) {
        CounterModel.create(createObj, function(err, result) {
            if(err || !result) handleError(err_msg);
            else {
              console.log(succ_msg);
            }
        })
    } else console.log(`${name} already exists.`)
  }

  function handleError(msg) {
    console.log(msg);
    return;
  }


//#endregion helper functions
