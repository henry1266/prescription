const express = require('express');
const moment = require('moment');
const { MongoClient } = require('mongodb');
const router = express.Router();

const uri = "mongodb://localhost:27017"; // MongoDB 連接 URI
const client = new MongoClient(uri);

router.get('/', async (req, res) => {
    try {
        await client.connect();
        const db = client.db("pharmacy");
        const prescriptions = db.collection("prescriptions");

        // 設置日期範圍，這裡以當前日期為基準
        const endDate = moment();
        
        const startDate = moment().subtract(8 * 7 - 1, 'days');

        
        const endDateFormatted = endDate.format('YYYYMMDD');
        //console.log( endDateFormatted);
        const startDateFormatted = startDate.format('YYYYMMDD');
        // 計算該月份的開始和結束日期
     
        // 聚合查詢
        const data = await prescriptions.aggregate([
            {
                $match: {
                    predate: { $gte: startDateFormatted, $lte: endDateFormatted }
                }
            },
            {
                $group: {
                    _id: { date: "$predate" },
                    prescriptionCount: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.date": 1 }
            }
        ]).toArray();

        // 構建數據
        const datesInWeeks = [];
        const weeklySums = [];

        for (let week = 0; week < 8; week++) {
            const weekData = [];
            let weekSum = 0;
            for (let day = 0; day < 7; day++) {
                const currentDate = moment(startDate).add(week * 7 + day, 'days').format('YYYYMMDD');
   
                const dayData = data.find(d => d._id.date === currentDate);
                const prescriptionCount = dayData ? dayData.prescriptionCount : 0;

                weekData.push({
                    date: moment(currentDate, 'YYYYMMDD').format('YYYY-MM-DD'),
                    value: prescriptionCount
                });

                weekSum += prescriptionCount;
            }
            datesInWeeks.push(weekData);
            weeklySums.push(weekSum);
        }
        
        const firstDate = moment().startOf('month').format('YYYYMMDD');
        const lastDate = moment().endOf('month').format('YYYYMMDD');
        
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
        
        // 將數據轉換為 Map 以加速查找
        const dataMap = new Map();
        data1.forEach(d => {
            dataMap.set(d._id.date, d.prescriptionCount || 0);
        });
        
        // 迭代當月的所有日期
        for (let day = 1; day <= moment().daysInMonth(); day++) {
            const date = moment().date(day).format('YYYYMMDD'); // 格式化當日日期
            const prescriptionCount = dataMap.get(date) || 0; // 查找該日的處方數量
        
            // 添加到日曆數據
            datesInMonth.push({ date, value: prescriptionCount });
        
            // 計算統計數據
            if (prescriptionCount > 0) {
                totalSum += prescriptionCount;
                nonZeroDays++;
            }
        }
        
        // 計算平均值
        const average = nonZeroDays > 0 ? (totalSum / nonZeroDays).toFixed(2) : 0;

        //console.log( datesInMonth);
  
        // 查詢當日的所有來客時間
    const prescriptionc = await prescriptions
    .find({ predate: endDateFormatted })
    .project({ presec: 1 }) // 只提取 presec 欄位
    .toArray();

  // 提取時間數據
  const times = prescriptionc.map(prescription => prescription.presec);
       
        
        // 傳遞數據到模板
        res.render('dashboard', { datesInMonth, moment ,datesInWeeks, weeklySums,times });
        
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Error fetching data");
    } finally {
        await client.close();
    }
});

module.exports = router;
