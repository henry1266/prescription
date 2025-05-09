// routes/updatePatient.js
const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

router.post("/:pid", async (req, res) => {
  const pid = req.params.pid;
  const { pname, pdate, pvip, pphone, pline, pdetail } = req.body;
  
  try {
    const db = dbManager.getDb(); // Get DB instance from manager
    const patientsCollection = db.collection("patients");

    // 更新患者信息
    await patientsCollection.updateOne(
      { pid: pid },
      {
        $set: {
          pname: pname,
          pdate: pdate,
          pvip: pvip,
          pphone: pphone,
          pline: pline,
          pdetail: pdetail
        }
      }
    );

    // 更新成功后重定向到查询页面，或者可以返回一个成功的JSON响应
    // res.redirect(`/searchPrescriptions?pid=${pid}`); 
    // Consider sending a JSON response for API consistency if this is not a form submission expecting redirect
    res.json({ message: "患者信息已成功更新", pid: pid });

  } catch (error) {
    console.error("Error in POST /updatePatient/:pid :", error);
    // res.render("result1", { errorMessage: "更新病人信息时出错" });
    // If this is an API endpoint, send a JSON error response
    res.status(500).json({ errorMessage: "更新病人信息时出错", pid: pid });
  }
  // No client.close() here, connection is managed centrally by dbManager
});

module.exports = router;

