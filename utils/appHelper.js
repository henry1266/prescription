const { ObjectId } = require("mongodb");
const dbManager = require("./database");

async function deletePrescriptionById(prescriptionId) {
    const db = dbManager.getDb();
    const result = await db.collection("prescriptions").deleteOne({ _id: new ObjectId(prescriptionId) });
    return result;
}

module.exports = {
    deletePrescriptionById,
};

