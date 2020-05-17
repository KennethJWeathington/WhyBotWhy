import { Document, Model, connect, connection } from 'mongoose';

//#region Mongoose

const mongoDB = process.env.DB_CONN_STRING;
connect(mongoDB, { useNewUrlParser: true });
const db = connection;
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
async function loadDocument<T extends Document>(model: Model<T>, findObj: {}) {
  return model.findOne(findObj).exec();
}

async function loadDocuments<T extends Document>(model: Model<T>, findObj: {}) {
  return model.find(findObj).exec();
}

/**
 * Creates and saves a document object.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document deletes.
 * @param {Array} arr An array containing the body of the Twitch message delimited by space.
 * @param {model} model Model of schema of document to create.
 * @param {Object} createObj Object containing the initial values of the document to be created.
 * @param {Function} afterSaveFunc Callback function to be called after document successfully saves.
 */
async function createDocument<T extends Document>(
  model: Model<T>,
  createObj: {}
) {
  return model.create(createObj);
}

/**
 * Deleted documents matching the search criteria from the specified Collection of Documents.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document deletes.
 * @param {model} model Model of schema of document to delete.
 * @param {Object} searchObj Search criteria to limit deletion of documents.
 */
async function deleteDocument<T extends Document>(
  model: Model<T>,
  searchObj: {}
) {
  return model.deleteOne(searchObj).exec();
}

/**
 * Updates a property on a document object if specified, then saves the document object.
 * @param {string} channel The Twitch channel to send any messages to.
 * @param {string} name Name to display in chat message after document updates.
 * @param {Object} obj Object to update.
 * @param {string} [propName] Property on obj to update.
 * @param {*} [newVal] New value to set to prop.
 * @param {string} [msg] Message to display in chat after document updates.
 */
async function updateDocument<T extends Document>(obj: T) {
  return obj.save();
}

export {
  updateDocument,
  createDocument,
  deleteDocument,
  loadDocument,
  loadDocuments,
};
