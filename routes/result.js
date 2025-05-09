const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // 引入 MongoDB 客戶端

router.get('/', async (req, res) => {
  try {
    await client.connect();
    const db = client.db("pharmacy");
    const patientsCollection = db.collection("patients");
    const prescriptionsCollection = db.collection("prescriptions");

    const pid = req.query.pid;
    const patient = await patientsCollection.findOne({ pid });
    const prescriptions = await prescriptionsCollection.find({ pid }).toArray();
    
    if (!patient) {
      return res.render('result', { errorMessage: '没有找到相关患者信息' });
    }

    res.render('result', {
      prescriptions,
      patient,
      pid: patient.pid,
      pname: patient.pname,
      pdate: patient.pdate,
      pvip: patient.pvip,
      pphone: patient.pphone,
      pline: patient.pline,
      pdetail: patient.pdetail,
      errorMessage: prescriptions.length > 0 ? null : '没有找到相关处方信息',
    });
    
  } catch (error) {
    console.error(error);
    res.render('result', { errorMessage: '查询时出错' });
  } finally {
    await client.close();
  }
});

module.exports = router;