const express = require('express');
const moment = require('moment');
const { MongoClient } = require('mongodb'); // 使用 MongoDB 原生驅動
const router = express.Router();

const uri = "mongodb://localhost:27017"; // MongoDB 連接 URI
const client = new MongoClient(uri);

router.get('/:year/:month', async (req, res) => {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month) - 1; // Moment.js 的月份從 0 開始

    // 檢查年份和月份是否有效
    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
        return res.status(400).send("Invalid year or month");
    }

    try {
        await client.connect();
        const db = client.db("pharmacy");
        const prescriptions = db.collection("prescriptions");

        // 計算該月份的開始和結束日期
        const firstDate = moment([year, month]).startOf('month').format('YYYYMMDD');
        const lastDate = moment([year, month]).endOf('month').format('YYYYMMDD');

        // 聚合查詢：根據 `predate` 分組並計算每天的處方數
        const data1 = await prescriptions.aggregate([
            {
                $match: {
                    predate: { $gte: firstDate, $lte: lastDate }
                }
            },
            {
                $group: {
                    _id: { date: "$predate" }, // 按 `predate` 分組
                    prescriptionCount: { $sum: 1 } // 統計每天的處方數
                }
            },
            {
                $sort: { "_id.date": 1 } // 按日期排序
            }
        ]).toArray();

        // 構建日曆數據
        let datesInMonth = [];
        let totalSum = 0;
        let nonZeroDays = 0;

        for (let day = 1; day <= moment(firstDate, 'YYYYMMDD').daysInMonth(); day++) {
            const date = moment([year, month]).date(day).format('YYYYMMDD');
            const dayData = data1.find(d => d._id.date === date);
            const prescriptionCount = dayData ? dayData.prescriptionCount : 0;

            datesInMonth.push({ date, value: prescriptionCount });

            if (prescriptionCount > 0) {
                totalSum += prescriptionCount;
                nonZeroDays++;
            }
        }

        const average = nonZeroDays > 0 ? (totalSum / nonZeroDays).toFixed(2) : 0;

        // 傳遞數據到模板
        res.render('calendar', { datesInMonth, moment, totalSum, average });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Error fetching data");
    } finally {
        await client.close();
    }
});

module.exports = router;
