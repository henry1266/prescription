const express = require(\'express\');
const router = express.Router();
const moment = require(\'moment\');
const dbManager = require(\'../utils/database\'); // Use the new database manager

router.get(\'/:year/:month\', async (req, res) => {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month) - 1; // Moment.js months are 0-indexed

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
        return res.status(400).send(\"Invalid year or month\");
    }

    try {
        const db = dbManager.getDb(); // Get DB instance from manager
        const prescriptions = db.collection(\"prescriptions\");

        const firstDate = moment([year, month]).startOf(\'month\').format(\'YYYYMMDD\');
        const lastDate = moment([year, month]).endOf(\'month\').format(\'YYYYMMDD\');

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

        for (let day = 1; day <= moment(firstDate, \'YYYYMMDD\').daysInMonth(); day++) {
            const date = moment([year, month]).date(day).format(\'YYYYMMDD\');
            const dayData = data1.find(d => d._id.date === date);
            const prescriptionCount = dayData ? dayData.prescriptionCount : 0;

            datesInMonth.push({ date, value: prescriptionCount });

            if (prescriptionCount > 0) {
                totalSum += prescriptionCount;
                nonZeroDays++;
            }
        }

        const average = nonZeroDays > 0 ? (totalSum / nonZeroDays).toFixed(2) : 0;

        res.render(\'calendar\', { datesInMonth, moment, totalSum, average });
    } catch (error) {
        console.error(\"Error fetching data:\", error);
        res.status(500).send(\"Error fetching data\");
    }
    // No client.close() here, connection is managed centrally
});

module.exports = router;
