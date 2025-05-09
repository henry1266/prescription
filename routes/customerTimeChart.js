const express = require('express');
const router = express.Router();
const formatDate = require('../utils/formatDate'); // 假設 formatDate 在上層目錄
const client = require('../utils/db'); // 引入 MongoDB 客戶端

router.get('/', async (req, res) => {
  const selectedDate1 = req.query.predate; // 從查詢參數獲取日期
  if (!selectedDate1) {
    return res.status(400).send("缺少必要的日期參數 predate");
  }

  const formattedDate1 = formatDate(selectedDate1);

  try {
    await client.connect();
    const db = client.db("pharmacy");
    const prescriptionsCollection = db.collection("prescriptions");

    // 查詢當日的所有來客時間
    const prescriptions = await prescriptionsCollection
      .find({ predate: formattedDate1 })
      .project({ presec: 1 }) // 只提取 presec 欄位
      .toArray();

    // 提取時間數據
    const times = prescriptions.map(prescription => prescription.presec);
    console.log( formattedDate1);
    res.render('customerTimeChart', { times, formattedDate1 });
  } catch (e) {
    console.error("查詢資料時出錯:", e);
    res.status(500).send("查詢失敗");
  } finally {
    await client.close();
  }
});

module.exports = router;
