const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/database'); // Assuming database.js exports getDb

const parseDateYYYYMMDD = (yyyymmdd) => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    try {
        const year = parseInt(yyyymmdd.slice(0, 4), 10);
        const month = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
        const day = parseInt(yyyymmdd.slice(6, 8), 10);
        return new Date(Date.UTC(year, month, day));
    } catch (e) {
        console.error(`Error parsing date: ${yyyymmdd}`, e);
        return null;
    }
};

const formatDateYYYY_MM_DD = (date) => {
    if (!date) return null;
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const calculateEndDate = (predateStr, preday, precount) => {
    const startDate = parseDateYYYYMMDD(predateStr);
    if (!startDate || isNaN(preday) || isNaN(precount) || preday <= 0 || precount <= 0) {
        return null;
    }
    const totalDays = preday * precount;
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + totalDays - 1);
    return endDate;
};

// Route to display the chart page
router.get('/', async (req, res) => {
    const db = getDb();
    if (!db) {
        return res.status(503).send('Database not connected');
    }
    const prescriptionsCollection = db.collection('prescriptions');

    try {
        const notes = await prescriptionsCollection
            .find({ pretype: '04' }, { projection: { pid: 1, predate: 1, preday: 1, precount: 1, _id: 0 } })
            .sort({ predate: 1 })
            .toArray();

        const dailyCounts = {};
        for (const item of notes) {
            const startDate = parseDateYYYYMMDD(item.predate);
            if (!startDate || isNaN(item.preday) || isNaN(item.precount)) continue;
            const days = item.preday * item.precount;
            for (let i = 0; i < days; i++) {
                const date = new Date(startDate);
                date.setUTCDate(date.getUTCDate() + i);
                const key = formatDateYYYY_MM_DD(date);
                if (key) {
                    dailyCounts[key] = (dailyCounts[key] || 0) + 1;
                }
            }
        }
        const calendar = Object.entries(dailyCounts).map(([date, count]) => ({
            date,
            count
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.render('prescriptionChart', { notes, calendar }); // Render the new EJS file

    } catch (error) {
        console.error('Error fetching data for chart page:', error);
        res.status(500).send('Internal Server Error');
    }
});

// API endpoint for completed prescriptions
router.get('/api/completed-prescriptions', async (req, res) => {
    const db = getDb();
    if (!db) {
        return res.status(503).send('Database not connected');
    }
    const prescriptionsCollection = db.collection('prescriptions');
    const { startDate, endDate } = req.query;

    const filterStartDate = startDate ? new Date(startDate + 'T00:00:00Z') : null;
    const filterEndDate = endDate ? new Date(endDate + 'T23:59:59Z') : null;

    if (!filterStartDate || !filterEndDate || isNaN(filterStartDate) || isNaN(filterEndDate)) {
        return res.status(400).json({ error: 'Invalid or missing startDate or endDate. Use yyyy-mm-dd format.' });
    }
    if (filterStartDate > filterEndDate) {
        return res.status(400).json({ error: 'startDate cannot be after endDate.' });
    }

    try {
        const allPrescriptions = await prescriptionsCollection
            .find({ pretype: '04' }, { projection: { pid: 1, predate: 1, preday: 1, precount: 1, _id: 0 } })
            .toArray();

        const candidates = [];
        for (const p of allPrescriptions) {
            const prescriptionEndDate = calculateEndDate(p.predate, p.preday, p.precount);
            if (prescriptionEndDate && prescriptionEndDate >= filterStartDate && prescriptionEndDate <= filterEndDate) {
                candidates.push({ 
                    pid: p.pid, 
                    endDate: prescriptionEndDate, 
                    endDateFormatted: formatDateYYYY_MM_DD(prescriptionEndDate),
                    predate: p.predate 
                });
            }
        }

        const finalResults = [];
        const checkedPids = new Set();
        const latestPredateByPid = {};

        for (const p of allPrescriptions) {
            if (!latestPredateByPid[p.pid] || p.predate > latestPredateByPid[p.pid]) {
                latestPredateByPid[p.pid] = p.predate;
            }
        }

        for (const candidate of candidates) {
            if (checkedPids.has(candidate.pid)) {
                continue;
            }
            if (latestPredateByPid[candidate.pid] === candidate.predate) {
                finalResults.push({ 
                    pid: candidate.pid, 
                    endDate: candidate.endDateFormatted
                });
            }
            checkedPids.add(candidate.pid);
        }
        
        finalResults.sort((a, b) => {
            if (a.endDate < b.endDate) return -1;
            if (a.endDate > b.endDate) return 1;
            if (a.pid < b.pid) return -1;
            if (a.pid > b.pid) return 1;
            return 0;
        });

        res.json({ completedPrescriptions: finalResults });

    } catch (error) {
        console.error('Error fetching completed prescriptions:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
