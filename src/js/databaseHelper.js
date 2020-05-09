"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
//#region Mongoose
const mongoDB = process.env.DB_CONN_STRING;
mongoose_1.connect(mongoDB, { useNewUrlParser: true });
const db = mongoose_1.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
//#endregion Mongoose
/**
 * Loads multiple document object into chatElements.
 * @param {model} model Model of objects to load.
 * @param {Object} findObj Object containing search criteria for loaded objects.
 * @param {string} name Property name of chatElemnts that the document objects will be assigned to.
 * @param {boolean} loadOne Searches for and loads a single document if true.
 * @param {*} def Default value if no matching document found.
 * @returns {Promise<Document>} Promise containing loaded documents.
 */
async function loadDocument(model, findObj, name, loadOne, def = null) {
    let promise;
    if (loadOne)
        promise = model.findOne(findObj).exec();
    else
        promise = model.find(findObj).exec();
    let result = await promise;
    if (result)
        chatElements[name] = result;
    else if (def)
        chatElements[name] = def;
    console.log(`Loaded ${name}`);
}
exports.loadDocument = loadDocument;
/**
 * Creates and saves a document object.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document deletes.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 * @param {model} model Model of schema of document to create.
 * @param {Object} createObj Object containing the initial values of the document to be created.
 * @param {Function} afterSaveFunc Callback function to be called after document successfully saves.
 */
async function createDocument(channel, name, arr, model, createObj) {
    const promise = model.create(createObj);
    const result = await promise;
    arr.push(result);
    chatClient.say(channel, `${name} saved!`);
    return promise;
}
exports.createDocument = createDocument;
/**
 * Deleted documents matching the search criteria from the specified Collection of Documents.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document deletes.
 * @param {model} model Model of schema of document to delete.
 * @param {Object} searchObj Search criteria to limit deletion of documents.
 */
async function deleteDocument(channel, name, model, searchObj) {
    await model.deleteOne(searchObj).exec();
    chatClient.say(channel, `${name} deleted.`);
}
exports.deleteDocument = deleteDocument;
/**
 * Updates a property on a document object if specified, then saves the document object.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document updates.
 * @param {Object} obj Object to update.
 * @param {string} [propName] Property on obj to update.
 * @param {*} [newVal] New value to set to prop.
 * @param {string} [msg] Message to display in chat after document updates.
 */
async function updateDocument(channel, name, obj, propName, newVal, msg) {
    if (propName)
        obj[propName] = newVal;
    if (!msg)
        msg = `${name} updated.`;
    await obj.save();
    chatClient.say(channel, msg);
}
exports.updateDocument = updateDocument;
