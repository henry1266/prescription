// routes/getReports.js
const express = require("express");
const router = express.Router();
const formatDate = require("../utils/formatDate"); // Assuming formatDate is in the parent directory
const dbManager = require("../utils/database"); // Use the new database manager

router.post("/", async (req, res) => {
  const startDate = formatDate(req.body.startDate);
  const endDate = formatDate(req.body.endDate);

  let reports = [];
  let aboveyy = 0;
  let belowyy = 0;

  try {
    const db = dbManager.getDb(); // Get DB instance from manager
    const reportsCollection = db.collection("reports");
    const patientsCollection = db.collection("patients");
    const testsCollection = db.collection("tests");

    reports = await reportsCollection.find({
      rdate: { $gte: startDate, $lte: endDate },
    }).toArray();

    for (let report of reports) {
      const patient = await patientsCollection.findOne({ pid: report.pid });
      if (patient) {
        report.pname = patient.pname;
        report.pdate = patient.pdate;

        const birthYear = parseInt(patient.pdate.substring(0, 4));
        const currentYear = new Date().getFullYear();
        report.page = currentYear - birthYear;
        if (report.page > 50) {
          aboveyy++;
        } else {
          belowyy++;
        }
      }

      if (report.test && Array.isArray(report.test)) {
        for (let test of report.test) {
          if (test.tinsuranceCode) {
            const testData = await testsCollection.findOne({ tinsuranceCode: test.tinsuranceCode });
            if (testData) {
              test.tname = testData.tname;
            } else {
              test.tname = "未知檢測項目";
            }
          }
        }
      }
    }

    res.render("report", { reports, startDate, endDate, aboveyy, belowyy });
  } catch (e) {
    console.error("查詢數據時出錯:", e);
    res.status(500).send("伺服器錯誤，無法查詢報告");
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

