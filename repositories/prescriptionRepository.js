const { ObjectId } = require("mongodb");
const dbManager = require("../utils/database");

const COLLECTION_NAME = "prescriptions";

async function find(query) {
    const db = dbManager.getDb();
    return db.collection(COLLECTION_NAME).find(query).toArray();
}

async function findById(id) {
    const db = dbManager.getDb();
    return db.collection(COLLECTION_NAME).findOne({ _id: new ObjectId(id) });
}

async function updateOne(filter, updateDoc, options = {}) {
    const db = dbManager.getDb();
    return db.collection(COLLECTION_NAME).updateOne(filter, updateDoc, options);
}

async function deleteOne(filter) {
    const db = dbManager.getDb();
    return db.collection(COLLECTION_NAME).deleteOne(filter);
}

// Specific update for prei status, similar to what was in prescriptionHelper
async function updatePreiStatus(prescriptionId, checkField, preiValue) {
    const db = dbManager.getDb();
    return db.collection(COLLECTION_NAME).updateOne(
        { _id: new ObjectId(prescriptionId) },
        { $set: { [checkField]: preiValue } }
    );
}

module.exports = {
    find,
    findById,
    updateOne,
    deleteOne,
    updatePreiStatus,
};

