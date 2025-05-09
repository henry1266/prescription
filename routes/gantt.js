const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const client = require('../utils/db'); // 引入 MongoDB 客戶端
const axios = require('axios');
// 配置 LINE Bot 的存取權杖
const accessToken = 'exoanGGQhg1U2w5LDl4RJwHYAKezrU1MY9BUTTFuVVyu9srVXbJoV6HiF3t3Nm9q72myd6cHjsoSMqx3vf8D/M/J5PopwJFsgMJy3qYvoyG/icHwWVIUsZkbyWhUUyW0/CK4hVnqXR/Vjsa3IP8COAdB04t89/1O/w1cDnyilFU=';

router.get('/', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('pharmacy');
    const prescriptions = db.collection('prescriptions');
    const patients = db.collection('patients');

    // Query prescriptions
    const nonZeroAndNotEmptyPrem = await prescriptions
      .find({ pretype: "04", prem: { $nin: ["0", 0], $ne: null, $exists: true } })
      .toArray();

    // Calculate counts
    const nonZeroAndNotEmptyPremCount = nonZeroAndNotEmptyPrem.length;
    const premCount = nonZeroAndNotEmptyPrem.filter(item => item.prem === "1").length;

    // Process each prescription
    for (let prescription of nonZeroAndNotEmptyPrem) {
      const patient = await patients.findOne({ pid: prescription.pid });
      prescription.pname = patient ? patient.pname : "未知姓名";
      prescription.pline = patient ? patient.pline : null;

      // Format predate and create predateDate for sorting
      if (prescription.predate) {
        const predateStr = prescription.predate.toString(); // e.g., "20230101"
        const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`; // e.g., "2023-01-01"
        const predate = new Date(formattedPredate);
        if (!isNaN(predate.getTime())) {
          prescription.predateDate = predate; // Store Date object for sorting
          prescription.formattedPredate = formattedPredate; // For display
        } else {
          prescription.predateDate = null; // Invalid date
          prescription.formattedPredate = "N/A";
        }
      } else {
        prescription.predateDate = null;
        prescription.formattedPredate = "N/A";
      }

      // Calculate calculatedDate and remainingDays
      if (prescription.predate && prescription.preday && prescription.precount) {
        const predateStr = prescription.predate.toString();
        const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`;
        const predate = new Date(formattedPredate);
        const totalDays = prescription.preday * prescription.precount;
        const calculatedDate = new Date(predate);
        calculatedDate.setDate(predate.getDate() + totalDays);

        if (!isNaN(calculatedDate.getTime())) {
          prescription.calculatedDate = calculatedDate.toISOString().split('T')[0];
          const today = new Date();
          const remainingDays = Math.ceil((calculatedDate - today) / (1000 * 60 * 60 * 24));
          prescription.remainingDays = remainingDays;

          // Update prem to "0" if remainingDays <= 0
          if (remainingDays <= 0) {
            await prescriptions.updateOne(
              { _id: prescription._id },
              { $set: { prem: "0" } }
            );
            console.log(`Updated prem to 0 for prescription ID: ${prescription._id}`);
          }
        } else {
          prescription.calculatedDate = "N/A";
          prescription.remainingDays = null;
        }
      } else {
        prescription.calculatedDate = "N/A";
        prescription.remainingDays = null;
      }
    }

    // Determine sorting method from query parameter (default to 'remainingDays')
    const sortBy = req.query.sort === 'predate' ? 'predate' : 'remainingDays';

    // Sort the array
    nonZeroAndNotEmptyPrem.sort((a, b) => {
      if (sortBy === 'predate') {
        // Sort by predateDate, nulls at the end
        if (a.predateDate === null) return 1;
        if (b.predateDate === null) return -1;
        return a.predateDate - b.predateDate; // Ascending order (oldest first)
      } else {
        // Sort by remainingDays, nulls at the end
        if (a.remainingDays === null) return 1;
        if (b.remainingDays === null) return -1;
        return a.remainingDays - b.remainingDays; // Ascending order (least days first)
      }
    });

    // Render the sorted data, passing sortBy for UI feedback
    res.render('gantt', {
      nonZeroAndNotEmptyPrem,
      nonZeroAndNotEmptyPremCount,
      premCount,
      sortBy
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  } finally {
    await client.close();
  }
});

router.post('/update_prei/:id', async (req, res) => {
  const prescriptionId = req.params.id;
  const { value } = req.body; // 获取查询参数 value
  //console.log(prescriptionId); // 打印
  //console.log(value); // 打印
  // 根據 value 設置 prei0
  const prei0 = value === 'false' ? '1' : '0';
  //console.log(prei0); // 打印
  try {
      await client.connect(); // 连接数据库
      const db = client.db("pharmacy");
      const prescriptionsCollection = db.collection("prescriptions");

      
      // 使用 ObjectId 轉換處方 ID 並更新處方資訊
          await prescriptionsCollection.updateOne(
            { _id: new ObjectId(prescriptionId) },
            { $set: { prei0: prei0 } }
          );
      
      
      //res.status(200).send('Success');
      // 更新成功后重定向到查询页面
      res.redirect(`/gantt`);
  } catch (err) {
      console.error(err);
      res.status(500).send('Error');
  } finally {
      await client.close(); // 关闭数据库连接
  }

});
router.get('/getPatientPline', async (req, res) => {
  const pid = req.query.pid;
  
  //console.log(req.body);

  try {
      await client.connect();
      const db = client.db('pharmacy');
      const patients = db.collection('patients');

      const patient = await patients.findOne({ pid: pid });

      if (patient) {
          res.json({ success: true, pline: patient.pline });
      } else {
          res.json({ success: false });
      }
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
      await client.close();
  }
});

router.post('/send_endmessage', async (req, res) => {
  const { plineField1, panme1, enddate1, prescriptionId } = req.body;

  //console.log('Received request:', { plineField1, panme1, enddate1, prescriptionId }); // 調試用

  if (!plineField1 || !panme1) {
      console.error('聊天室ID或訊息內容為空');
      return res.send('<p>聊天室ID或訊息內容不得為空！</p><a href="/">回到首頁</a>');
  }

  let actualLineId = plineField1;

  // 如果 plineField1 是 pid，查詢對應的 LINE ID
  if (!plineField1.startsWith('U')) { // LINE ID 通常以 'U' 開頭
      try {
          await client.connect();
          const db = client.db('pharmacy');
          const patients = db.collection('patients');

          const patient = await patients.findOne({ pid: plineField1 });
          if (!patient || !patient.pline) {
              console.error(`未找到病人的 LINE ID for pid: ${plineField1}`);
              return res.send('<p>無法找到病人的 LINE ID！</p><a href="/">回到首頁</a>');
          }
          actualLineId = patient.pline;
          console.log(`Found LINE ID: ${actualLineId} for pid: ${plineField1}`);
      } catch (error) {
          console.error('資料庫查詢失敗:', error);
          return res.send('<p>資料庫查詢失敗</p><a href="/">回到首頁</a>');
      } finally {
          await client.close();
      }
  }

  const bubbleMessage = {
    type: 'flex',
    altText: '竹文回診通知',
    contents: {
        type: 'bubble',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: '慢箋結束通知', weight: 'bold', size: 'xl', align: 'center' },
                { type: 'text', text: `通知${panme1}先生/女士，您的慢性處方箋即將結束。`, wrap: true },
                { type: 'text', text: '建議可在回診前一個禮拜抽血追蹤健康狀況，感謝您。', wrap: true },
                {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                        { type: 'icon', url: 'https://img.lovepik.com/png/20231010/White-exclamation-mark-sign-above-red-triangle-traffic-warning_156615_wh860.png', offsetStart: '31%' },
                        { type: 'text', text: '處方結束日', align: 'center', margin: 'md', size: 'md' }
                    ],
                    margin: 'lg'
                },
                { type: 'text', text: enddate1, wrap: true, color: '#666666', size: 'md', flex: 5, align: 'center', margin: 'md' }
            ]
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'button',
                    color: '#857465',
                    style: 'primary',
                    action: {
                        type: 'postback',
                        label: '回診預約',
                        data: '回診預約'
                    }
                }
            ]
        }
    }
};

  const data = { to: actualLineId, messages: [bubbleMessage] };

  try {
      const response = await axios.post('https://api.line.me/v2/bot/message/push', data, {
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`
          }
      });
      //console.log('LINE API成功推送:', response.data);
      res.send('推送訊息成功');

      // **通知成功後更新 prei = 0**
      await client.connect();
      const db = client.db("pharmacy");
      const prescriptionsCollection = db.collection("prescriptions");
      await prescriptionsCollection.updateOne(
        { _id: new ObjectId(prescriptionId) },
        { $set: { prei0: "0" } }
      );



  } catch (error) {
      const errorDetail = error.response ? error.response.data : error.message;
      console.error('推送訊息失敗:', errorDetail);
      res.send(`<p>推送訊息失敗: ${JSON.stringify(errorDetail)}</p>`);
  }
});


module.exports = router;
