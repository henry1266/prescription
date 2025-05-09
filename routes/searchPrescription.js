const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // 引入 MongoDB 客戶端

// 民国日期转换为西元日期的函数
function convertToWesternDate(taiwanDate) {
  const year = parseInt(taiwanDate.substring(0, 3)) + 1911;
  const monthDay = taiwanDate.substring(3);
  return `${year}${monthDay}`;
}

router.get('/', async (req, res) => {
  const { query } = req.query;
  let prescriptions = [];
  let prescriptionsByDate = {};
  let searchQuery = {};
  let patient = null;

  if (!query) {
    return res.json({ errorMessage: '请输入查询内容' });
  }

  // 判断输入内容的类型
  if (/^\d+$/.test(query)) {
     // 纯数字，可能是民国日期
     searchQuery.pdate = convertToWesternDate(query);
  } else if (/^[a-zA-Z0-9]+$/.test(query)) {
    // 英文+数字，可能是患者ID
    searchQuery.pid = query;
  } else {
    // 纯文字，可能是姓名
    searchQuery.pname = query;
  }

  try {
    await client.connect();
    const db = client.db("pharmacy");
    const patientsCollection = db.collection("patients");

    // 查找与查询条件匹配的患者
    patient = await patientsCollection.findOne(searchQuery);
    //console.log("Received query:", req.query);
 
    if (patient) {
      searchQuery.pid = patient.pid; // 使用查询到的患者ID进行处方查询
      
    } else {
      return res.json({ errorMessage: '没有找到相关患者信息' });
    }
  } catch (error) {
    console.error(error);
    return res.json({ errorMessage: '查询患者信息时出错' });
  }

  try {
    const db = client.db("pharmacy");
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");

    // 查找与查询条件匹配的处方
    prescriptions = await prescriptionsCollection.find({ pid: searchQuery.pid }).sort({ predate: -1 }).toArray();
 
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

    // 返回查询结果
    res.json({
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
    res.json({ errorMessage: '查询时出错' });
  } finally {
    await client.close();
  }
});

module.exports = router;