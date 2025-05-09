const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('pharmacy');
    const prescriptions = db.collection('prescriptions');
    const patients = db.collection('patients');

    // 查詢 `pretype` 為 "04" 且 `prem` 不為 0 和不為空的處方，按 `predate` 排序
    const nonZeroAndNotEmptyPrem = await prescriptions
      .find({ pretype: "04", prem: { $nin: ["0", 0], $ne: null, $exists: true } })
      .sort({ predate: 1 })
      .toArray();

    // 查詢總數
    const nonZeroAndNotEmptyPremCount = nonZeroAndNotEmptyPrem.length;

    // 找到最小的 predate
    const minDate = new Date(
      Math.min(
        ...nonZeroAndNotEmptyPrem.map(p => {
          const predateStr = p.predate.toString();
          const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`;
          return new Date(formattedPredate);
        })
      )
    );

    for (let prescription of nonZeroAndNotEmptyPrem) {
      const patient = await patients.findOne({ pid: prescription.pid });
      prescription.pname = patient ? patient.pname : "未知姓名";

      if (prescription.predate) {
        prescription.formattedPredate = `${prescription.predate.slice(0, 4)}-${prescription.predate.slice(4, 6)}-${prescription.predate.slice(6, 8)}`;
      } else {
        prescription.formattedPredate = "N/A";
      }

      // 計算 Predate + (Preday * Precount) 後的日期
      if (prescription.predate && prescription.preday && prescription.precount) {
        const predateStr = prescription.predate.toString();
        const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`;
        const predate = new Date(formattedPredate);
        const totalDays = prescription.preday * prescription.precount;
        const calculatedDate = new Date(predate);
        calculatedDate.setDate(predate.getDate() + totalDays);

        if (!isNaN(calculatedDate.getTime())) {
          prescription.calculatedDate = calculatedDate.toISOString().split('T')[0];

          // 計算 remainingDays
          const today = new Date();
          const remainingDays = Math.ceil((calculatedDate - today) / (1000 * 60 * 60 * 24));

          // 如果 remainingDays 為 0，將 prem 更新為 0
          if (remainingDays <= 0) {
            await prescriptions.updateOne(
              { _id: prescription._id },
              { $set: { prem: "0" } }
            );
            console.log(`Updated prem to 0 for prescription ID: ${prescription._id}`);
          }
        } else {
          prescription.calculatedDate = "N/A";
        }

        // 計算 predate - minDate 的差值天數
        const diffFromMinDate = Math.ceil((predate - minDate) / (1000 * 60 * 60 * 24));
        prescription.diffFromMinDate = diffFromMinDate; // 加到處方數據中
      } else {
        prescription.calculatedDate = "N/A";
        prescription.diffFromMinDate = "N/A"; // 如果數據缺失
      }
    }

    // 查詢剩下的 `pretype` 為 "04" 的處方，按 `predate` 排序
    const remainingPrescriptions = await prescriptions
      .find({ pretype: "04", $or: [{ prem: "0" }, { prem: null }, { prem: { $exists: false } }] })
      .sort({ predate: 1 })
      .toArray();

    // 查詢剩餘總數
    const remainingPrescriptionsCount = remainingPrescriptions.length;

    for (let prescription of remainingPrescriptions) {
      const patient = await patients.findOne({ pid: prescription.pid });
      prescription.pname = patient ? patient.pname : "未知姓名";

      if (prescription.predate) {
        prescription.formattedPredate = `${prescription.predate.slice(0, 4)}-${prescription.predate.slice(4, 6)}-${prescription.predate.slice(6, 8)}`;
      } else {
        prescription.formattedPredate = "N/A";
      }

      // 計算 Predate + (Preday * Precount) 後的日期
      if (prescription.predate && prescription.preday && prescription.precount) {
        const predateStr = prescription.predate.toString();
        const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`;
        const predate = new Date(formattedPredate);
        const totalDays = prescription.preday * prescription.precount;
        const calculatedDate = new Date(predate);
        calculatedDate.setDate(predate.getDate() + totalDays);

        if (!isNaN(calculatedDate.getTime())) {
          prescription.calculatedDate = calculatedDate.toISOString().split('T')[0];
        } else {
          prescription.calculatedDate = "N/A";
        }
      } else {
        prescription.calculatedDate = "N/A";
      }
    }

    // 渲染模板，傳遞總筆數和計算好的數據
    res.render('filter', { 
      nonZeroAndNotEmptyPrem, 
      remainingPrescriptions, 
      nonZeroAndNotEmptyPremCount, 
      remainingPrescriptionsCount 
    });
  } finally {
    await client.close();
  }
});

module.exports = router;