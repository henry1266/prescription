// routes/searchByInsuranceCode.js
const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

router.post("/", async (req, res) => {
  const insuranceCode = req.body.dinsuranceCode;
  let totalCost = 0;
  let totalQuantity = 0;
  let medication = null;
  let errorMessage = null;

  try {
    const db = dbManager.getDb(); // Get default DB instance (pharmacy)
    const medicationsCollection = db.collection("medications");
    const prescriptionsCollection = db.collection("prescriptions");

    medication = await medicationsCollection.findOne({ dinsuranceCode: insuranceCode });

    if (medication) {
      const prescriptions = await prescriptionsCollection.find({ "drug.dinsuranceCode": insuranceCode }).toArray();
      prescriptions.forEach(prescription => {
        prescription.drug.forEach(drug => {
          if (drug.dinsuranceCode === insuranceCode) {
            totalQuantity += drug.dcount;
            totalCost += drug.dcount * medication.dcost;
          }
        });
      });
    } else {
      errorMessage = "找不到該健保碼對應的藥品";
    }

    res.render("medicationResult", {
      medication,
      totalQuantity,
      totalCost,
      insuranceCode,
      errorMessage,
    });
  } catch (error) {
    console.error("查詢錯誤:", error);
    res.status(500).send("伺服器錯誤");
  }
  // No client.close() here, connection is managed centrally
});

router.get("/match", async (req, res) => {
  const query = req.query.query;
  try {
    const db = dbManager.getDb(); // Get default DB instance (pharmacy)
    const medicationsCollection = db.collection("medications");
    const results = await medicationsCollection.find({ dinsuranceCode: { $regex: query, $options: "i" } }).toArray();
    res.json(results);
  } catch (error) {
    console.error("查詢錯誤:", error);
    res.status(500).send("伺服器錯誤");
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

