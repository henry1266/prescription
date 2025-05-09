// routes/searchByDate.js
const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager
const formatDate = require("../utils/formatDate"); // Assuming formatDate is in the parent directory

router.post("/", async (req, res) => {
  const startDate = formatDate(req.body.startdate);
  const endDate = formatDate(req.body.enddate);

  let medicationsList = {};
  let totalCost = 0;

  try {
    const db = dbManager.getDb(); // Get default DB instance (pharmacy)
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");

    const prescriptions = await prescriptionsCollection.find({
      predate: { $gte: startDate, $lte: endDate }
    }).toArray();

    for (let prescription of prescriptions) {
      for (let drug of prescription.drug) {
        const medication = await medicationsCollection.findOne({ dinsuranceCode: drug.dinsuranceCode });
        
        if (medication) {
          if (!medicationsList[medication.dinsuranceCode]) {
            medicationsList[medication.dinsuranceCode] = {
              dinsuranceCode: medication.dinsuranceCode,
              dname: medication.dname,
              dcost: medication.dcost,
              dcount: drug.dcount,
              totalCost: drug.dcount * medication.dcost,
            };
          } else {
            medicationsList[medication.dinsuranceCode].dcount += drug.dcount;
            medicationsList[medication.dinsuranceCode].totalCost += drug.dcount * medication.dcost;
          }
        }
      }
    }

    totalCost = Object.values(medicationsList).reduce((acc, med) => acc + med.totalCost, 0);
    
    res.render("medicationResultByDate", {
      medicationsList,
      totalCost,
      startDate,
      endDate,
      errorMessage: null,
    });
  } catch (error) {
    console.error("Error in POST /searchByDate:", error);
    res.render("medicationResultByDate", {
      medicationsList: {},
      totalCost: 0,
      startDate,
      endDate,
      errorMessage: "查詢時出錯",
    });
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

