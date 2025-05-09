// routes/getReports1.js
const express = require('express');
const router = express.Router();
const formatDate = require('../utils/formatDate'); // 假設 formatDate 在上層目錄
const client = require('../utils/db'); // 引入 MongoDB 客戶端

router.post('/', async (req, res) => {
  const startDate = formatDate(req.body.startDate);
  const endDate = formatDate(req.body.endDate);

  let reports = [];
  let aboveyy = 0;
  let belowyy = 0;

  try {
    await client.connect();
    const db = client.db('pharmacy');
    const reportsCollection = db.collection('reports');
    const patientsCollection = db.collection('patients');
    const testsCollection = db.collection('tests');

    // 查詢指定日期範圍內的報告數據
    reports = await reportsCollection.find({
      rdate: { $gte: startDate, $lte: endDate },
    }).toArray();

    for (let report of reports) {
      // 查找病患信息
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

      // 遍歷 `test` 陣列中的每個 tinsuranceCode
      if (report.test && Array.isArray(report.test)) {
        for (let test of report.test) {
          if (test.tinsuranceCode) {
            const testData = await testsCollection.findOne({ tinsuranceCode: test.tinsuranceCode });
            if (testData) {
              test.tname = testData.tname;
            } else {
              test.tname = '未知檢測項目';
            }
          }
        }
      }
    }

    // 渲染報告頁面，傳遞報告數據
    res.render('reportAge', { reports, startDate, endDate, aboveyy, belowyy });
  } catch (e) {
    console.error('查詢數據時出錯:', e);
    res.status(500).send('伺服器錯誤，無法查詢報告');
  } finally {
    await client.close();
  }
});

module.exports = router;
