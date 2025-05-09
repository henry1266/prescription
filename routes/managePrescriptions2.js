const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const client = require('../utils/db'); // 引入 MongoDB 客戶端

const axios = require('axios');
// 配置 LINE Bot 的存取權杖
const accessToken = 'exoanGGQhg1U2w5LDl4RJwHYAKezrU1MY9BUTTFuVVyu9srVXbJoV6HiF3t3Nm9q72myd6cHjsoSMqx3vf8D/M/J5PopwJFsgMJy3qYvoyG/icHwWVIUsZkbyWhUUyW0/CK4hVnqXR/Vjsa3IP8COAdB04t89/1O/w1cDnyilFU=';

router.get('/', async (req, res) => {
    const pid = req.query.pid; // 获取查询参数 pid
    const today = new Date();
    const todayString = today.toISOString().split('T')[0].replace(/-/g, ''); // 转换为 yyyymmdd 格式
    let prescriptions = [];

    try {
        await client.connect(); // 连接数据库
        const db = client.db("pharmacy");
        const prescriptionsCollection = db.collection("prescriptions");
        const patientsCollection = db.collection("patients");

        // 查询符合条件的项目
        const query = {
            $or: [
                { predate2: { $ne: 0, $exists: true } },
                { predate3: { $ne: 0, $exists: true } }
            ]
        };

        if (pid) {
            query.pid = pid;
        }

        const allPrescriptions = await prescriptionsCollection.find(query).toArray();

        // 根据 pid 反查患者信息并格式化结果
        const formattedPrescriptions = await Promise.all(
            allPrescriptions.flatMap(async item => {
                const patient = await patientsCollection.findOne({ pid: item.pid });
                const pname = patient ? patient.pname : "Unknown";
                const pline = patient ? patient.pline : "Unknown";
                const pphone = patient ? patient.pphone : "Unknown";
                const pdetail = patient ? patient.pdetail : "Unknown";

                const rows = [];
                if (item.predate2 && item.predate2 !== 0) {
                    rows.push({ id: item._id, precount:item.precount, type: 'predate2', check: 'prei2', value: item.predate2, pname, pline, pphone, pdetail, pid: item.pid, preday: item.preday , prei: item.prei2});
                }
                if (item.predate3 && item.predate3 !== 0) {
                    rows.push({ id: item._id, precount:item.precount, type: 'predate3', check: 'prei3', value: item.predate3, pname, pline, pphone, pdetail, pid: item.pid, preday: item.preday , prei: item.prei3});
                }
                return rows;
            })
        );

        // 按 value 对今天进行分组并排序
        const groupedPrescriptions = formattedPrescriptions.flat().reduce((acc, item) => {
            if (parseInt(item.value) > parseInt(todayString)) {
                acc.afterToday.push(item);
            } else {
                acc.beforeToday.push(item);
            }
            return acc;
        }, { beforeToday: [], afterToday: [] });

        // 对每组数据按 value 排序
        groupedPrescriptions.beforeToday.sort((a, b) => a.value - b.value);
        groupedPrescriptions.afterToday.sort((a, b) => a.value - b.value);

        // 将数据传递给 manageprescription.ejs
        res.render('manageprescription2', { prescriptions: groupedPrescriptions });
    } catch (error) {
        console.error("Error fetching prescriptions or patient data:", error);
        res.status(500).send("Internal Server Error");
    } finally {
        await client.close(); // 关闭数据库连接
    }
});

router.post('/update_prei/:id', async (req, res) => {
    const prescriptionId = req.params.id;
    const { prei, check } = req.body;

    try {
        await client.connect();
        const db = client.db("pharmacy");
        const prescriptionsCollection = db.collection("prescriptions");

        await prescriptionsCollection.updateOne(
            { _id: new ObjectId(prescriptionId) },
            { $set: { [check]: prei } }
        );

        res.json({ success: true, prei });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "更新失敗" });
    } finally {
        await client.close();
    }
});

// 發送領藥通知
router.post('/send_message', async (req, res) => {
    const { pline, panme, startdate, enddate, id, precount, check, prescriptionId } = req.body;
    //console.log(req.body);

    if (!pline || !panme) {
        res.send('聊天室ID或訊息內容不得為空！');
        return;
    }

    const bubbleMessage = {
        type: 'flex',
        altText: '竹文領藥通知',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '處方領藥通知',
                        weight: 'bold',
                        size: 'xl',
                        align: 'center',
                    },
                    {
                        type: 'text',
                        text: '通知' + panme + '先生/女士，︁您的慢性處方箋藥已經準備好。',
                        wrap: true,
                    },
                    {
                        type: 'text',
                        text: '可持健保卡至興安藥局領藥，︁謝謝。',
                    },
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            {
                                type: 'icon',
                                url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png',
                                offsetStart: '25%',
                            },
                            {
                                type: 'text',
                                text: '建議領藥區間',
                                align: 'center',
                                margin: 'md',
                                size: 'md',
                            },
                        ],
                        margin: 'lg',
                    },
                    {
                        type: 'text',
                        text: startdate + '-' + enddate,
                        wrap: true,
                        color: '#666666',
                        size: 'md',
                        flex: 5,
                        align: 'center',
                        margin: 'md',
                    },
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            {
                                type: 'icon',
                                url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png',
                                offsetStart: '33%',
                            },
                            {
                                type: 'text',
                                text: '處方資訊',
                                align: 'center',
                                margin: 'md',
                                size: 'md',
                            },
                        ],
                        margin: 'lg',
                    },
                    {
                        type: 'text',
                        text: '第' + id + '次 / 共' + precount + '次',
                        wrap: true,
                        color: '#666666',
                        size: 'md',
                        flex: 5,
                        align: 'center',
                        margin: 'md',
                    },
                ],
            },
        },
    };

    // 設定推送訊息的數據
    const data = {
        to: pline,
        messages: [bubbleMessage],
    };

    try {
        const response = await axios.post('https://api.line.me/v2/bot/message/push', data, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        console.log(`${panme} 推送通知成功！`);
        
        // **通知成功後更新 prei = 0**
        await client.connect();
        const db = client.db("pharmacy");
        const prescriptionsCollection = db.collection("prescriptions");

        await prescriptionsCollection.updateOne(
            { _id: new ObjectId(prescriptionId) },
            { $set: { [check]: "0" } }
        );

        res.json({ success: true, message: `${panme} 推送通知成功，prei 已更新！` });

    } catch (error) {
        console.error('推送訊息失敗:', error.response?.data || error.message);
        res.status(500).json({ error: '推送訊息失敗' });
    } finally {
        await client.close();
    }
});


module.exports = router;
