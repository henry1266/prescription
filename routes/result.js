const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

router.get("/", async (req, res) => {
  try {
    const db = dbManager.getDb(); // Get default DB instance (pharmacy)
    const patientsCollection = db.collection("patients");
    const prescriptionsCollection = db.collection("prescriptions");

    const pid = req.query.pid;
    const patient = await patientsCollection.findOne({ pid });
    const prescriptions = await prescriptionsCollection.find({ pid }).toArray();
    
    if (!patient) {
      return res.render("result", { errorMessage: "没有找到相关患者信息" });
    }

    res.render("result", {
      prescriptions,
      patient,
      pid: patient.pid,
      pname: patient.pname,
      pdate: patient.pdate,
      pvip: patient.pvip,
      pphone: patient.pphone,
      pline: patient.pline,
      pdetail: patient.pdetail,
      errorMessage: prescriptions.length > 0 ? null : "没有找到相关处方信息",
    });
    
  } catch (error) {
    console.error("Error in GET /result:", error);
    res.render("result", { errorMessage: "查询时出错" });
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

