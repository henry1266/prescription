// routes/searchByDate.js
const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // MongoDB client
const formatDate = require('../utils/formatDate'); // 假設 formatDate 在上層目錄
router.post('/', async (req, res) => {
  //const { startDate, endDate } = req.body;
  const startDate = formatDate(req.body.startdate);
  const endDate = formatDate(req.body.enddate);


  let medicationsList = {};
  let totalCost = 0;

  try {
    await client.connect();
    const db = client.db("pharmacy");
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");

    // Query prescriptions within the date range
    const prescriptions = await prescriptionsCollection.find({
      predate: { $gte: startDate, $lte: endDate }
    }).toArray();


    for (let prescription of prescriptions) {
      for (let drug of prescription.drug) {
        const medication = await medicationsCollection.findOne({ dinsuranceCode: drug.dinsuranceCode });
        // 查詢 drug.dname 是否存在
    
        
        if (medication) {
          //console.log("Medication Found:", medication); // 打印 medication 的完整內容
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

    // Calculate total cost
    totalCost = Object.values(medicationsList).reduce((acc, med) => acc + med.totalCost, 0);
    console.log("Rendered Medications List:", JSON.stringify(medicationsList, null, 2));
    res.render('medicationResultByDate', {
      medicationsList,
      totalCost,
      startDate,
      endDate,
      errorMessage: null,
    });
  } catch (error) {
    console.error(error);
    res.render('medicationResultByDate', {
      medicationsList: {},
      totalCost: 0,
      startDate,
      endDate,
      errorMessage: '查詢時出錯',
    });
  } finally {
    await client.close();
  }
});

module.exports = router;
