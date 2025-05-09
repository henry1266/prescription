const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

// 民国日期转换为西元日期的函数
function convertToWesternDate(taiwanDate) {
  if (typeof taiwanDate !== "string" || taiwanDate.length < 3) return taiwanDate; // Basic validation
  const yearStr = taiwanDate.substring(0, taiwanDate.length - 4);
  const monthDay = taiwanDate.substring(taiwanDate.length - 4);
  const year = parseInt(yearStr) + 1911;
  return `${year}${monthDay}`;
}

router.get("/", async (req, res) => {
  const { query } = req.query;
  let prescriptions = [];
  let searchQuery = {};
  let patient = null;

  if (!query) {
    return res.json({ patient: null, prescriptions: [], errorMessage: "请输入查询内容" });
  }

  // 判断输入内容的类型
  // 健保号 (pid) - 通常是字母和数字的组合，例如 AB12345678 或特定长度的数字
  // 民国日期 (pdate for patient, predate for prescription) - 例如 1100101 (YYYMMDD) or 900101 (YYMMDD)
  // 姓名 (pname)
  if (/^[A-Za-z0-9]{8,12}$/.test(query) && !/^\d+$/.test(query)) { // Heuristic for PID (alphanumeric, typical length)
    searchQuery.pid = query;
  } else if (/^\d{5,7}$/.test(query)) { // Heuristic for Minguo Date (5 to 7 digits)
    searchQuery.pdate = convertToWesternDate(query); // Assume date query refers to patient's registration or prescription date
    searchQuery.predate = convertToWesternDate(query); // Also consider it for prescription date
  } else if (/[\u4e00-\u9fa5]/.test(query)) { // Contains Chinese characters, likely a name
    searchQuery.pname = query;
  } else { // Default to PID if not clearly date or name, or could be a less common PID format
    searchQuery.pid = query;
  }

  try {
    const db = dbManager.getDb(); // Get default DB instance (pharmacy)
    const patientsCollection = db.collection("patients");
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");

    // Step 1: Find patient if query might identify one
    if (searchQuery.pid) {
        patient = await patientsCollection.findOne({ pid: searchQuery.pid });
    } else if (searchQuery.pname) {
        patient = await patientsCollection.findOne({ pname: searchQuery.pname });
    } else if (searchQuery.pdate) {
        // If query was a date, it could be patient's registration date or prescription date.
        // Let's try finding a patient by their registration date first.
        patient = await patientsCollection.findOne({ pdate: searchQuery.pdate });
    }

    // Step 2: Determine how to query prescriptions
    let prescriptionQueryCriteria = {};
    if (patient) {
        // If a patient is found by any means, primary search for their prescriptions
        prescriptionQueryCriteria.pid = patient.pid;
    } else if (searchQuery.pid) {
        // If query was a PID but no patient record found, still try to find prescriptions with this PID
        prescriptionQueryCriteria.pid = searchQuery.pid;
    } else if (searchQuery.predate) {
        // If query was a date and no specific patient found by that date as their pdate,
        // search for all prescriptions on that specific predate.
        prescriptionQueryCriteria.predate = searchQuery.predate;
    }
    // If query was by pname and no patient found, prescriptionQueryCriteria remains empty, so no prescriptions found.

    if (Object.keys(prescriptionQueryCriteria).length > 0) {
        prescriptions = await prescriptionsCollection.find(prescriptionQueryCriteria).sort({ predate: -1 }).toArray();
    }
    
    // Step 3: Process prescriptions (add medication details and calculate costs)
    for (let prescription of prescriptions) {
      prescription.totalPrescriptionCost = 0;
      if (prescription.drug && Array.isArray(prescription.drug)) {
        for (let drugItem of prescription.drug) {
          const medication = await medicationsCollection.findOne({ dinsuranceCode: drugItem.dinsuranceCode });
          if (medication) {
            drugItem.dname = medication.dname;
            drugItem.dcost = medication.dcost;
            // Ensure dcount and dcost are numbers before multiplying
            drugItem.dtotalCost = (parseFloat(drugItem.dcount) || 0) * (parseFloat(medication.dcost) || 0);
            prescription.totalPrescriptionCost += drugItem.dtotalCost;
          } else {
            drugItem.dname = "未知藥品";
            drugItem.dcost = 0;
            drugItem.dtotalCost = 0;
          }
        }
      } else {
        prescription.drug = []; // Ensure drug array exists to prevent errors
      }
    }

    // Step 4: Send response
    let errorMessage = null;
    if (prescriptions.length === 0) {
        if (patient) {
            errorMessage = "该患者没有处方记录";
        } else if (searchQuery.pid || searchQuery.pname) {
            errorMessage = "没有找到相关患者信息或处方记录";
        } else if (searchQuery.predate || searchQuery.pdate) {
            errorMessage = "该日期没有相关的处方记录或患者记录";
        } else {
             errorMessage = "没有找到符合条件的记录";
        }
    }

    res.json({
        patient: patient, // Can be null if no specific patient matched the query
        prescriptions: prescriptions,
        errorMessage: errorMessage
    });

  } catch (error) {
    console.error("Error in GET /searchPrescription:", error);
    res.status(500).json({ patient: null, prescriptions: [], errorMessage: "服务器内部错误，查询失败。" });
  }
});

module.exports = router;

