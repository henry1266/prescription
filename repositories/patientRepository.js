const dbManager = require("../utils/database");

const COLLECTION_NAME = "patients";

async function findByPid(pid) {
    const db = dbManager.getDb();
    return db.collection(COLLECTION_NAME).findOne({ pid: pid });
}

// Add other patient-related data access methods as needed
// async function find(query) { ... }
// async function findById(id) { ... }
// async function create(patientData) { ... }
// async function updateOne(filter, updateDoc, options = {}) { ... }
// async function deleteOne(filter) { ... }

module.exports = {
    findByPid,
};

