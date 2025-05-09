// routes/updatePrescription.js
const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const dbManager = require("../utils/database"); // Use the new database manager

router.post("/:id", async (req, res) => {
  const prescriptionId = req.params.id;
  const updatedDrugData = req.body.drug;
  const predate2 = req.body.predate2;
  const predate3 = req.body.predate3;
  const pretype = req.body.pretype;
  const prem = req.body.prem;
  const preday = req.body.preday;
  const precount = req.body.precount;
  const pid = req.body.pid;

  try {
    const db = dbManager.getDb(); // Get DB instance from manager
    const prescriptionsCollection = db.collection("prescriptions");

    // 構建藥品的更新數據
    const updatedDrugs = updatedDrugData.map(drug => ({
      dinsuranceCode: drug.dinsuranceCode,
      dcount: parseInt(drug.dcount, 10),
      df: drug.df
    }));

    // 使用 ObjectId 轉換處方 ID 並更新處方資訊
    await prescriptionsCollection.updateOne(
      { _id: new ObjectId(prescriptionId) },
      { $set: { 
          pretype: pretype, 
          prem: prem, 
          preday: preday, 
          precount: precount, 
          predate2: predate2, 
          predate3: predate3, 
          drug: updatedDrugs 
        } 
      }
    );

    // 渲染 result2 頁面，傳遞修改成功的數據
    res.render("result2", {
      message: "處方資訊已成功更新",
      pid: pid,
      errorMessage: null
    });
  } catch (error) {
    console.error("Error in POST /updatePrescription/:id :", error);
    res.render("result2", {
      errorMessage: "修改處方信息時出錯",
      message: null,
      pid: pid // Pass pid back even on error for context if available
    });
  } 
  // No client.close() here, connection is managed centrally by dbManager
});

module.exports = router;

