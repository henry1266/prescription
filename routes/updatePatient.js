// routes/updatePatient.js
const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // 引入 MongoDB 客戶端

router.post('/:pid', async (req, res) => {
  const pid = req.params.pid;
  const { pname, pdate, pvip, pphone, pline, pdetail } = req.body;
  console.log(pname);
  try {
    await client.connect();
    const db = client.db("pharmacy");
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

    // 更新成功后重定向到查询页面
    res.redirect(`/searchPrescriptions?pid=${pid}`);
  } catch (error) {
    console.error(error);
    res.render('result1', { errorMessage: '更新病人信息时出错' });
  } finally {
    await client.close();
  }
});

module.exports = router;
