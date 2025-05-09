const express = require("express");
const router = express.Router();
const { getDb } = require("../utils/database");
const ARIMA = require("arima");
const holtwinters = require("holtwinters");

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
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
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

async function getDailyCountsData(db) {
    const prescriptionsCollection = db.collection("prescriptions");
    const notes = await prescriptionsCollection
        .find({ pretype: "04" }, { projection: { predate: 1, preday: 1, precount: 1, _id: 0 } })
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
    return Object.entries(dailyCounts).map(([date, count]) => ({
        date,
        count
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
}

router.get("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).send("Database not connected");
    const prescriptionsCollection = db.collection("prescriptions");
    try {
        const notes = await prescriptionsCollection
            .find({ pretype: "04" }, { projection: { pid: 1, predate: 1, preday: 1, precount: 1, _id: 0 } })
            .sort({ predate: 1 })
            .toArray();
        const calendar = await getDailyCountsData(db);
        res.render("prescriptionChart", { notes, calendar });
    } catch (error) {
        console.error("Error fetching data for chart page:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/forecast", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).send("Database not connected");
    try {
        const calendar = await getDailyCountsData(db);
        res.render("forecastAnalysis", { calendar });
    } catch (error) {
        console.error("Error fetching data for forecast analysis page:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/api/completed-prescriptions", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).send("Database not connected");
    const prescriptionsCollection = db.collection("prescriptions");
    const { startDate, endDate } = req.query;
    const filterStartDate = startDate ? new Date(startDate + "T00:00:00Z") : null;
    const filterEndDate = endDate ? new Date(endDate + "T23:59:59Z") : null;
    if (!filterStartDate || !filterEndDate || isNaN(filterStartDate) || isNaN(filterEndDate)) {
        return res.status(400).json({ error: "Invalid or missing startDate or endDate. Use yyyy-mm-dd format." });
    }
    if (filterStartDate > filterEndDate) {
        return res.status(400).json({ error: "startDate cannot be after endDate." });
    }
    try {
        const allPrescriptions = await prescriptionsCollection
            .find({ pretype: "04" }, { projection: { pid: 1, predate: 1, preday: 1, precount: 1, _id: 0 } })
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
            if (checkedPids.has(candidate.pid)) continue;
            if (latestPredateByPid[candidate.pid] === candidate.predate) {
                finalResults.push({ pid: candidate.pid, endDate: candidate.endDateFormatted });
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
        console.error("Error fetching completed prescriptions:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/api/forecast/arima", async (req, res) => {
    try {
        const { data, p, d, q, P, D, Q, s, steps } = req.body;
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: "Missing or invalid data for ARIMA forecast." });
        }
        const arima = new ARIMA({
            p: p || 2, d: d || 1, q: q || 2,
            P: P || 1, D: D || 0, Q: Q || 1,
            s: s || 0, verbose: false
        });
        arima.train(data);
        const [predictions, errors] = arima.predict(steps || 7);
        res.json({ predictions, errors });
    } catch (error) {
        console.error("Error in ARIMA forecast:", error);
        res.status(500).json({ error: "Failed to generate ARIMA forecast", details: error.message });
    }
});

router.post("/api/forecast/holtwinters", async (req, res) => {
    try {
        const { data, alpha, beta, gamma, period, steps } = req.body;
        console.log("Holt-Winters Request Body:", req.body);
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: "Missing or invalid data for Holt-Winters forecast." });
        }
        if (typeof holtwinters !== "function"){
            console.error("holtwinters is not a function. Package might be imported incorrectly or not installed.");
            return res.status(500).json({ error: "Holt-Winters library not loaded correctly." });
        }

        const pAlpha = alpha !== undefined ? alpha : 0.5;
        const pBeta = beta !== undefined ? beta : 0.3;
        const pGamma = gamma !== undefined ? gamma : 0.2;
        const pPeriod = period !== undefined ? period : 0;
        const pSteps = steps || 7;

        console.log("Calling holtwinters with data (length):", data.length);
        console.log(`Calling holtwinters(${pAlpha}, ${pBeta}, ${pGamma}, ${pPeriod}, ${pSteps})`);

        // Corrected call to holtwinters: pass arguments directly
        const predictions = holtwinters(data, pAlpha, pBeta, pGamma, pPeriod, pSteps);
        
        console.log("Holt-Winters Raw Predictions:", predictions);

        if (!predictions || !Array.isArray(predictions)) {
            console.error("Holt-Winters returned invalid predictions:", predictions);
            // If predictions is an object with an 'augumentedDataset' and other stats, 
            // it means the library might be returning more than just the forecast.
            // For now, we assume it should return an array of forecasted values.
            return res.status(500).json({ error: "Holt-Winters forecast generated invalid results. Expected an array." });
        }

        res.json({ predictions });

    } catch (error) {
        console.error("Error in Holt-Winters forecast execution:", error);
        res.status(500).json({ error: "Failed to generate Holt-Winters forecast", details: error.message });
    }
});

module.exports = router;

