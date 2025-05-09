// routes/searchPrescriptions.js
const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // 引入 MongoDB 客戶端

router.get('/', async (req, res) => {
  const pid = req.query.pid;
  let prescriptions = [];
  let prescriptionsByDate = {};

  try {
    await client.connect();
    const db = client.db("pharmacy");
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");
    const patientsCollection = db.collection("patients");

    // 查找與 pid 匹配的處方
    prescriptions = await prescriptionsCollection.find({ pid: pid }).toArray();

    // 查找患者信息
    const patient = await patientsCollection.findOne({ pid: pid });

    // 查詢每張處方的藥品信息並計算總成本
    for (let prescription of prescriptions) {
	
      for (let drug of prescription.drug) {
        const medication = await medicationsCollection.findOne({ dinsuranceCode: drug.dinsuranceCode });
        if (medication) {
          drug.dname = medication.dname;
          drug.dcost = medication.dcost;
          drug.totalCost = drug.dcount * drug.dcost;
        }
      }

      // 計算每張處方的總成本
      prescription.prescriptionTotalCost = prescription.drug.reduce((total, drug) => total + drug.totalCost, 0);

      // 按日期分類處方
      if (!prescriptionsByDate[prescription.predate]) {
        prescriptionsByDate[prescription.predate] = [];
      }
      prescriptionsByDate[prescription.predate].push(prescription);
    }

    // 渲染結果頁面，傳遞查詢結果
    res.render('result1', {
      prescriptions,
      prescriptionsByDate,
      patient: patient || {},
      pid: patient ? patient.pid : '未知',
      pname: patient ? patient.pname : '未知',
      pdate: patient ? patient.pdate : '',
      pvip: patient ? patient.pvip : '',
      pphone: patient ? patient.pphone : '',
      pline: patient ? patient.pline : '',
      pdetail: patient ? patient.pdetail : '',
      errorMessage: prescriptions.length > 0 ? null : '沒有找到相關處方信息',
    });
  } catch (error) {
    console.error(error);
    res.render('result1', { errorMessage: '查詢時出錯' });
  } finally {
    await client.close();
  }
});


router.get('/', async (req, res) => {
  const { pid, pdate, pname } = req.query;
  let prescriptions = [];
  let prescriptionsByDate = {};
  let query = {};

  if (pid) {
    query.pid = pid;
  }
  if (pdate) {
    query.pdate = pdate;
  }
  if (pname) {
    query.pname = pname;
  }

  try {
    await client.connect();
    const db = client.db("pharmacy");
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");
    const patientsCollection = db.collection("patients");

    // 查找与查询条件匹配的处方
    prescriptions = await prescriptionsCollection.find(query).toArray();

    // 查找患者信息
    const patient = await patientsCollection.findOne(query);

    // 查询每张处方的药品信息并计算总成本
    for (let prescription of prescriptions) {
      for (let drug of prescription.drug) {
        const medication = await medicationsCollection.findOne({ dinsuranceCode: drug.dinsuranceCode });
        if (medication) {
          drug.dname = medication.dname;
          drug.dcost = medication.dcost;
          drug.totalCost = drug.dcount * drug.dcost;
        }
      }

      // 计算每张处方的总成本
      prescription.prescriptionTotalCost = prescription.drug.reduce((total, drug) => total + drug.totalCost, 0);

      // 按日期分类处方
      if (!prescriptionsByDate[prescription.predate]) {
        prescriptionsByDate[prescription.predate] = [];
      }
      prescriptionsByDate[prescription.predate].push(prescription);
    }

    // 渲染结果页面，传递查询结果
    res.render('result1', {
      prescriptions,
      prescriptionsByDate,
      patient: patient || {},
      pid: patient ? patient.pid : '未知',
      pname: patient ? patient.pname : '未知',
      pdate: patient ? patient.pdate : '',
      pvip: patient ? patient.pvip : '',
      pphone: patient ? patient.pphone : '',
      pline: patient ? patient.pline : '',
      pdetail: patient ? patient.pdetail : '',
      errorMessage: prescriptions.length > 0 ? null : '没有找到相关处方信息',
    });
  } catch (error) {
    console.error(error);
    res.render('result1', { errorMessage: '查询时出错' });
  } finally {
    await client.close();
  }
});

module.exports = router;
