const express = require('express');
const moment = require('moment');
const { MongoClient } = require('mongodb'); // 使用 MongoDB 原生驅動
const router = express.Router();

const uri = "mongodb://localhost:27017"; // MongoDB 連接 URI
const client = new MongoClient(uri);

router.get('/:year/:month/:day', async (req, res) => {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month) - 1; // Moment.js 的月份從 0 開始
    const day = parseInt(req.params.day);

    // 驗證年份、月份和日期
    if (
        isNaN(year) || 
        isNaN(month) || 
        isNaN(day) || 
        !/^\d{4}$/.test(req.params.year) || 
        !/^\d{1,2}$/.test(req.params.month) || 
        !/^\d{1,2}$/.test(req.params.day)
    ) {
        return res.status(400).send("Invalid year, month, or day format.");
    }

    const startDate = moment([year, month, day]);
    if (!startDate.isValid()) {
        return res.status(400).send("Invalid date value.");
    }

    console.log(`Start date: ${startDate.format('YYYY-MM-DD')}`);

    try {
        await client.connect();
        //console.log("Connected to MongoDB");

        const db = client.db("pharmacy");
        const prescriptions = db.collection("prescriptions");

        // 計算 8 週範圍內的開始和結束日期（往前推 8 週）
        const endDateFormatted = startDate.format('YYYYMMDD');
        const startDateFormatted = moment(startDate).subtract(8 * 7 - 1, 'days').format('YYYYMMDD');

        //console.log(`Date range: ${startDateFormatted} - ${endDateFormatted}`);

        // 聚合查詢：根據 `predate` 分組並計算每天的處方數
        const data = await prescriptions.aggregate([
            {
                $match: {
                    predate: { $gte: startDateFormatted, $lte: endDateFormatted }
                }
            },
            {
                $group: {
                    _id: { date: "$predate" }, // 按日期分組
                    prescriptionCount: { $sum: 1 } // 統計每天的處方數
                }
            },
            {
                $sort: { "_id.date": 1 } // 按日期排序
            }
        ]).toArray();

        //console.log("Aggregated data:", data);

        // 構建 8 週數據和每週總和
        const datesInWeeks = [];
        const weeklySums = []; // 存放每週總和

        for (let week = 0; week < 8; week++) {
            const weekData = [];
            let weekSum = 0; // 每週總和初始化
            for (let day = 0; day < 7; day++) {
                const currentDate = moment(startDate).subtract(8 * 7 - (week * 7 + day), 'days').format('YYYYMMDD');
                const dayData = data.find(d => d._id.date === currentDate);
                const prescriptionCount = dayData ? dayData.prescriptionCount : 0;

                weekData.push({
                    date: moment(currentDate, 'YYYYMMDD').format('YYYY-MM-DD'),
                    value: prescriptionCount
                });

                weekSum += prescriptionCount; // 累加每日數據到週總和
            }
            //console.log(`Week ${week + 1} data:`, weekData);
            //console.log(`Week ${week + 1} sum:`, weekSum);

            datesInWeeks.push(weekData);
            weeklySums.push(weekSum); // 存入週總和數據
        }

        console.log("Weekly sums:", weeklySums);

        // 傳遞數據到模板
        res.render('weeks', { datesInWeeks, moment, weeklySums });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Error fetching data");
    } finally {
        await client.close();
        console.log("MongoDB connection closed");
    }
});

module.exports = router;
