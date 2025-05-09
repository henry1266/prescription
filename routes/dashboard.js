const express = require(\'express');
const router = express.Router();
const moment = require(\'moment');
const dbManager = require(\'../utils/database'); // Use the new database manager

router.get(\'/:year/:month', async (req, res) => {
    try {
        const db = dbManager.getDb(); // Get DB instance from manager
        const prescriptions = db.collection(\"prescriptions\");

        const endDate = moment();
        const startDate = moment().subtract(8 * 7 - 1, \'days\');
        const endDateFormatted = endDate.format(\'YYYYMMDD');
        const startDateFormatted = startDate.format(\'YYYYMMDD');

        const data = await prescriptions.aggregate([
            {
                $match: {
                    predate: { $gte: startDateFormatted, $lte: endDateFormatted }
                }
            },
            {
                $group: {
                    _id: { date: \"$predate\" },
                    prescriptionCount: { $sum: 1 }
                }
            },
            {
                $sort: { \"_id.date\": 1 }
            }
        ]).toArray();

        const datesInWeeks = [];
        const weeklySums = [];
        for (let week = 0; week < 8; week++) {
            const weekData = [];
            let weekSum = 0;
            for (let day = 0; day < 7; day++) {
                const currentDate = moment(startDate).add(week * 7 + day, \'days\').format(\'YYYYMMDD');
                const dayData = data.find(d => d._id.date === currentDate);
                const prescriptionCount = dayData ? dayData.prescriptionCount : 0;
                weekData.push({
                    date: moment(currentDate, \'YYYYMMDD').format(\'YYYY-MM-DD'),
                    value: prescriptionCount
                });
                weekSum += prescriptionCount;
            }
            datesInWeeks.push(weekData);
            weeklySums.push(weekSum);
        }

        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month) - 1;
        const firstDate = moment([year, month]).startOf(\'month').format(\'YYYYMMDD');
        const lastDate = moment([year, month]).endOf(\'month').format(\'YYYYMMDD');

        const data1 = await prescriptions.aggregate([
            {
                $match: {
                    predate: { $gte: firstDate, $lte: lastDate }
                }
            },
            {
                $group: {
                    _id: { date: \"$predate\" },
                    prescriptionCount: { $sum: 1 }
                }
            },
            {
                $sort: { \"_id.date\": 1 }
            }
        ]).toArray();

        let datesInMonth = [];
        let totalSum = 0;
        let nonZeroDays = 0;
        const dataMap = new Map();
        data1.forEach(d => {
            dataMap.set(d._id.date, d.prescriptionCount || 0);
        });

        for (let day = 1; day <= moment(firstDate, \'YYYYMMDD').daysInMonth(); day++) {
            const date = moment([year, month]).date(day).format(\'YYYYMMDD');
            const prescriptionCount = dataMap.get(date) || 0;
            datesInMonth.push({ date, value: prescriptionCount });
            if (prescriptionCount > 0) {
                totalSum += prescriptionCount;
                nonZeroDays++;
            }
        }
        const average = nonZeroDays > 0 ? (totalSum / nonZeroDays).toFixed(2) : 0;

        const prescriptionc = await prescriptions
            .find({ predate: endDateFormatted })
            .project({ presec: 1 })
            .toArray();
        const times = prescriptionc.map(prescription => prescription.presec);

        res.render(\'dashboard', { datesInMonth, moment, datesInWeeks, weeklySums, times });
    } catch (error) {
        console.error(\"Error fetching data:\", error);
        res.status(500).send(\"Error fetching data\");
    }
    // No client.close() here, connection is managed centrally
});

module.exports = router;
