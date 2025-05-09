// routes/calculate.js
const express = require(\'express\');
const router = express.Router();
const moment = require(\'moment\');
const { ObjectId } = require(\'mongodb\'); // ObjectId might be needed for delete
const dbManager = require(\'../utils/database\'); // Use the new database manager

router.get(\'/\', async (req, res) => {
  const startDate = moment(req.query.startdate, \'YYYY-MM-DD\').format(\'YYYYMMDD\');
  const endDate = moment(req.query.enddate, \'YYYY-MM-DD\').format(\'YYYYMMDD\');

  let totalDayCost = 0;
  let prescriptions = [];

  try {
    const db = dbManager.getDb(); // Get DB instance from manager

    prescriptions = await db.collection(\"prescriptions\").find({
      predate: {
        $gte: startDate,
        $lte: endDate
      }
    }).toArray();

    for (let prescription of prescriptions) {
      const patient = await db.collection(\"patients\").findOne({ pid: prescription.pid });
      if (patient) {
        prescription.pname = patient.pname;
        prescription.pvip = patient.pvip;
      }
    }

    for (const prescription of prescriptions) {
      let prescriptionTotalCost = 0;
      for (const drug of prescription.drug) {
        const medication = await db.collection(\'medications\').findOne({ dinsuranceCode: drug.dinsuranceCode });
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

    const averagePrescriptionCost = prescriptions.length > 0 ? totalDayCost / prescriptions.length : 0;

    res.render(\'calculate\', { prescriptions, totalDayCost, averagePrescriptionCost, startDate, endDate });

  } catch (e) {
    console.error(\"查詢數據時出錯:\", e);
    res.status(500).send(\"服務器錯誤，無法計算成本\");
  }
  // No client.close() here, connection is managed centrally
});

router.post(\'/delete/:id\', async (req, res) => {
  const prescriptionId = req.params.id;
  try {
    const db = dbManager.getDb(); // Get DB instance from manager
    const result = await db.collection(\"prescriptions\").deleteOne({ _id: new ObjectId(prescriptionId) });

    if (result.deletedCount === 1) {
      res.status(200).send({ message: \'Prescription deleted successfully\' });
    } else {
      res.status(404).send({ message: \'Prescription not found\' });
    }
  } catch (e) {
    console.error(\"Error deleting prescription:\", e);
    res.status(500).send({ message: \'Server error, unable to delete prescription\' });
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;
