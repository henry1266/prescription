// routes/searchPrescriptions.js
const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

router.get("/", async (req, res) => {
  const pid = req.query.pid;
  const { pdate, pname } = req.query; // Also accept pdate and pname for the combined logic
  let prescriptions = [];
  let prescriptionsByDate = {};
  let query = {};
  let patient = null;

  if (pid) {
    query.pid = pid;
  } else if (pdate) {
    query.pdate = pdate; // This might need conversion if it's Minguo format
  } else if (pname) {
    query.pname = pname;
  }

  if (Object.keys(query).length === 0 && !pid) { // Check if any query param was actually provided
      return res.render("result1", { 
          prescriptions: [], 
          prescriptionsByDate: {}, 
          patient: {},
          pid: "",
          pname: "",
          pdate: "",
          pvip: "",
          pphone: "",
          pline: "",
          pdetail: "",
          errorMessage: "請輸入查詢條件"
      });
  }

  try {
    const db = dbManager.getDb(); // Get DB instance from manager
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");
    const patientsCollection = db.collection("patients");

    // Find patient information based on the query
    if (query.pid) {
        patient = await patientsCollection.findOne({ pid: query.pid });
    } else if (query.pname) {
        patient = await patientsCollection.findOne({ pname: query.pname });
    } else if (query.pdate) {
        // If querying by pdate, there might be multiple patients. 
        // For simplicity, we'll fetch the first one or handle as needed.
        // This part might need more specific logic based on requirements.
        patient = await patientsCollection.findOne({ pdate: query.pdate });
    }

    // If a patient is found, use their pid to find prescriptions for consistency
    // Otherwise, if the original query was for prescriptions by date (and no specific patient found by that date),
    // this logic might need adjustment. For now, we prioritize finding prescriptions linked to a found patient.
    let prescriptionSearchQuery = {};
    if (patient) {
        prescriptionSearchQuery.pid = patient.pid;
    } else if (query.pid) { // If original query was a PID but no patient found
        prescriptionSearchQuery.pid = query.pid; // Still search prescriptions by this PID
    } else if (query.pdate && !patient) {
        // If query was by date and no patient found, this case is ambiguous.
        // Let's assume we don't search prescriptions if no patient context and query wasn't PID.
        // Or, if the intent is to find ALL prescriptions on a date regardless of patient, that's different.
        // For now, if no patient and query wasn't PID, we won't find prescriptions.
    }
    // If query was by patient name and no patient found, prescriptionSearchQuery will be empty, leading to no prescriptions.

    if (Object.keys(prescriptionSearchQuery).length > 0) {
        prescriptions = await prescriptionsCollection.find(prescriptionSearchQuery).sort({ predate: -1 }).toArray();
    }

    for (let prescription of prescriptions) {
      for (let drug of prescription.drug) {
        const medication = await medicationsCollection.findOne({ dinsuranceCode: drug.dinsuranceCode });
        if (medication) {
          drug.dname = medication.dname;
          drug.dcost = medication.dcost;
          drug.totalCost = drug.dcount * drug.dcost;
        }
      }
      prescription.prescriptionTotalCost = prescription.drug.reduce((total, drug) => total + (drug.totalCost || 0), 0);
      if (!prescriptionsByDate[prescription.predate]) {
        prescriptionsByDate[prescription.predate] = [];
      }
      prescriptionsByDate[prescription.predate].push(prescription);
    }

    res.render("result1", {
      prescriptions,
      prescriptionsByDate,
      patient: patient || {},
      pid: patient ? patient.pid : (query.pid || "未知"),
      pname: patient ? patient.pname : (query.pname || "未知"),
      pdate: patient ? patient.pdate : (query.pdate || ""),
      pvip: patient ? patient.pvip : "",
      pphone: patient ? patient.pphone : "",
      pline: patient ? patient.pline : "",
      pdetail: patient ? patient.pdetail : "",
      errorMessage: prescriptions.length > 0 ? null : (patient ? "該患者沒有相關處方信息" : "沒有找到相關患者或處方信息"),
    });

  } catch (error) {
    console.error("Error in GET /searchPrescriptions:", error);
    res.render("result1", { 
        prescriptions: [], 
        prescriptionsByDate: {}, 
        patient: {},
        pid: query.pid || "",
        pname: query.pname || "",
        pdate: query.pdate || "",
        pvip: "",
        pphone: "",
        pline: "",
        pdetail: "",
        errorMessage: "查詢時出錯，請檢查伺服器日誌。"
    });
  }
  // No client.close() here, connection is managed centrally by dbManager
});

module.exports = router;

