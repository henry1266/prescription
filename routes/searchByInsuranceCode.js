// routes/searchByInsuranceCode.js
const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // 引入 MongoDB 客戶端

router.post('/', async (req, res) => {
  const insuranceCode = req.body.dinsuranceCode;
  let totalCost = 0;
  let totalQuantity = 0;
  let medication = null;
  let errorMessage = null;

  try {
    await client.connect();
    const db = client.db("pharmacy");
    const medicationsCollection = db.collection("medications");
    const prescriptionsCollection = db.collection("prescriptions");

    // 查找藥品信息
    medication = await medicationsCollection.findOne({ dinsuranceCode: insuranceCode });

    if (medication) {
      // 查找該藥品的處方記錄
      const prescriptions = await prescriptionsCollection.find({ "drug.dinsuranceCode": insuranceCode }).toArray();

      // 計算藥品總數量和總成本
      prescriptions.forEach(prescription => {
        prescription.drug.forEach(drug => {
          if (drug.dinsuranceCode === insuranceCode) {
            totalQuantity += drug.dcount;
            totalCost += drug.dcount * medication.dcost;
          }
        });
      });
    } else {
      // 若未找到該藥品，設置錯誤消息
      errorMessage = '找不到該健保碼對應的藥品';
    }

    // 渲染結果頁面
    res.render('medicationResult', {
      medication,
      totalQuantity,
      totalCost,
      insuranceCode,
      errorMessage,
    });
  } catch (error) {
    console.error("查詢錯誤:", error);
    res.status(500).send("伺服器錯誤");
  } finally {
    await client.close();
  }
});

// 新增路由來處理部分匹配的查詢
router.get('/match', async (req, res) => {
  const query = req.query.query;
  try {
    await client.connect();
    const db = client.db("pharmacy");
    const medicationsCollection = db.collection("medications");

    // 查詢部分匹配的藥品
    const results = await medicationsCollection.find({ dinsuranceCode: { $regex: query, $options: 'i' } }).toArray();
    res.json(results);
  } catch (error) {
    console.error("查詢錯誤:", error);
    res.status(500).send("伺服器錯誤");
  } finally {
    await client.close();
  }
});
module.exports = router;
