// routes/calculate.js
const express = require('express');
const router = express.Router();
const moment = require('moment');
const client = require('../utils/db'); // 引入 MongoDB 客戶端


router.get('/', async (req, res) => {
  //const startDate = formatDate(req.query.startdate);
  //const endDate = formatDate(req.query.enddate);
  const startDate = moment(req.query.startdate, 'YYYY-MM-DD').format('YYYYMMDD');
  const endDate = moment(req.query.enddate, 'YYYY-MM-DD').format('YYYYMMDD');

  let totalDayCost = 0;
  let prescriptions = [];

  try {
    await client.connect();
    const db = client.db("pharmacy");

    // 查詢符合日期範圍的處方
    prescriptions = await db.collection("prescriptions").find({
      predate: {
        $gte: startDate,
        $lte: endDate
      }
    }).toArray();

    // 為每個處方添加患者信息
    for (let prescription of prescriptions) {
      const patient = await db.collection("patients").findOne({ pid: prescription.pid });
      if (patient) {
        prescription.pname = patient.pname;
        prescription.pvip = patient.pvip;
      }
    }

    // 計算每個處方的總成本
    for (const prescription of prescriptions) {
      let prescriptionTotalCost = 0;

      for (const drug of prescription.drug) {
        const medication = await db.collection('medications').findOne({ dinsuranceCode: drug.dinsuranceCode });
        if (medication) {
          const drugCost = drug.dcount * medication.dcost;
          prescriptionTotalCost += drugCost;
          drug.dname = medication.dname;
          drug.dcost = medication.dcost;
          drug.totalCost = drugCost;
        }
      }

      prescription.prescriptionTotalCost = prescriptionTotalCost;
      totalDayCost += prescriptionTotalCost;
    }

    const averagePrescriptionCost = totalDayCost / prescriptions.length;

    res.render('calculate', { prescriptions, totalDayCost, averagePrescriptionCost, startDate, endDate });

  } catch (e) {
    console.error("查詢數據時出錯:", e);
    res.status(500).send("服務器錯誤，無法計算成本");
  } finally {
    await client.close();
  }
});
router.post('/delete/:id', async (req, res) => {
  const prescriptionId = req.params.id;

  try {
    await client.connect();
    const db = client.db("pharmacy");

    // Delete the prescription by ID
    const result = await db.collection("prescriptions").deleteOne({ _id: new ObjectId(prescriptionId) });

    if (result.deletedCount === 1) {
      res.status(200).send({ message: 'Prescription deleted successfully' });
    } else {
      res.status(404).send({ message: 'Prescription not found' });
    }

  } catch (e) {
    console.error("Error deleting prescription:", e);
    res.status(500).send({ message: 'Server error, unable to delete prescription' });
  } finally {
    await client.close();
  }
});

module.exports = router;
