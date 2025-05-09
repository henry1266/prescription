const express = require("express");
const router = express.Router();
const prescriptionHelper = require("../utils/prescriptionHelper");

router.get("/", async (req, res) => {
    const pid = req.query.pid;
    try {
        // Use the helper function, default sort for beforeToday is 'desc'
        const groupedPrescriptions = await prescriptionHelper.getProcessedPrescriptions(pid);
        res.render("manageprescription", { prescriptions: groupedPrescriptions });
    } catch (error) {
        console.error("Error fetching prescriptions or patient data:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/update_prei/:id", async (req, res) => {
    const prescriptionId = req.params.id;
    const { prei, check } = req.body;
    try {
        const result = await prescriptionHelper.updatePreiStatus(prescriptionId, prei, check);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "更新失敗" });
    }
});

router.post("/send_message", async (req, res) => {
    const { pline, panme, startdate, enddate, id, precount, check, prescriptionId } = req.body;
    try {
        const result = await prescriptionHelper.sendLineNotification(pline, panme, startdate, enddate, id, precount, check, prescriptionId);
        res.json(result);
    } catch (error) {
        console.error("推送訊息失敗:", error.response?.data || error.message);
        // Check if the error is from LINE API or our custom error from helper
        if (error.message === "LINE ID or patient name cannot be empty." || error.message === "LINE_ACCESS_TOKEN is not defined in environment variables.") {
            res.status(400).json({ error: error.message }); 
        } else {
            res.status(500).json({ error: "推送訊息失敗" });
        }
    }
});

module.exports = router;

