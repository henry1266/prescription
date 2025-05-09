const express = require("express");
const router = express.Router();
const prescriptionService = require("../services/prescriptionService");

router.get("/", async (req, res) => {
    const pid = req.query.pid;
    try {
        const groupedPrescriptions = await prescriptionService.getGroupedPrescriptions(pid, "desc"); // Default sort 'desc'
        res.render("manageprescription", { prescriptions: groupedPrescriptions });
    } catch (error) {
        console.error("Error in GET /manageprescription:", error.message);
        res.status(500).send(error.message || "Internal Server Error");
    }
});

router.post("/update_prei/:id", async (req, res) => {
    const prescriptionId = req.params.id;
    const { prei, check } = req.body;
    try {
        const result = await prescriptionService.updatePrescriptionStatus(prescriptionId, prei, check);
        res.json(result);
    } catch (err) {
        console.error("Error in POST /update_prei/:id:", err.message);
        res.status(500).json({ error: err.message || "更新失敗" });
    }
});

router.post("/send_message", async (req, res) => {
    const { pline, panme, startdate, enddate, id, precount, check, prescriptionId } = req.body;
    try {
        const result = await prescriptionService.sendPrescriptionNotification(pline, panme, startdate, enddate, id, precount, check, prescriptionId);
        res.json(result);
    } catch (error) {
        console.error("Error in POST /send_message:", error.message);
        if (error.message.includes("LINE ID or patient name cannot be empty") || error.message.includes("LINE_ACCESS_TOKEN is not configured")) {
            res.status(400).json({ error: error.message }); 
        } else {
            res.status(500).json({ error: error.message || "推送訊息失敗" });
        }
    }
});

module.exports = router;

