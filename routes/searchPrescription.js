const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

// 民国日期转换为西元日期的函数
function convertToWesternDate(taiwanDate) {
  if (typeof taiwanDate !== "string" || taiwanDate.length < 3) return taiwanDate; // Basic validation
  const year = parseInt(taiwanDate.substring(0, 3)) + 1911;
  const monthDay = taiwanDate.substring(3);
  return `${year}${monthDay}`;
}

router.get("/", async (req, res) => {
  const { query } = req.query;
  let prescriptions = [];
  let prescriptionsByDate = {};
  let searchQuery = {};
  let patient = null;

  if (!query) {
    return res.json({ errorMessage: "请输入查询内容" });
  }

  // 判断输入内容的类型
  if (/^\d+$/.test(query) && query.length >= 5 && query.length <= 7) { // Assuming Minguo date format like 1100101 (7 digits) or 900101 (6 digits) or 90101 (5 digits)
     searchQuery.pdate = convertToWesternDate(query);
  } else if (/^[a-zA-Z0-9]+$/.test(query)) {
    searchQuery.pid = query;
  } else {
    searchQuery.pname = query;
  }

  try {
    const db = dbManager.getDb(); // Get default DB instance (pharmacy)
    const patientsCollection = db.collection("patients");
    const prescriptionsCollection = db.collection("prescriptions");
    const medicationsCollection = db.collection("medications");

    // First, try to find patient based on the initial searchQuery
    // If query was pid, searchQuery.pid is set. If name, searchQuery.pname. If date, searchQuery.pdate.
    if (searchQuery.pid) {
        patient = await patientsCollection.findOne({ pid: searchQuery.pid });
    } else if (searchQuery.pname) {
        patient = await patientsCollection.findOne({ pname: searchQuery.pname });
    } else if (searchQuery.pdate) {
        // If query was a date, we might find multiple patients. For this logic, we might need to adjust
        // or assume it's for finding prescriptions by date primarily, and patient info is secondary.
        // For now, let's assume if a date is given, we search prescriptions by that date and then try to find one patient.
        // This part of logic might need refinement based on exact desired behavior for date queries.
        // The original code seemed to imply finding ONE patient even with a date query.
        patient = await patientsCollection.findOne({ pdate: searchQuery.pdate });
    }
 
    if (patient) {
      // If a patient was found, use their PID for prescription search for consistency
      searchQuery.pid = patient.pid;
    } else {
        // If no patient found by initial query (e.g. name or specific PID didn't match, or date didn't match a pdate)
        // And the original query was NOT a PID (because if it was a PID and not found, then no patient)
        // This path means we didn't find a patient by name or date. We should indicate no patient found.
        // However, the original code would proceed to search prescriptions with searchQuery.pid which might be undefined.
        // Let's ensure if no patient, we report it clearly.
        if (!searchQuery.pid) { // If the query wasn't a PID to begin with and no patient found by name/date
            return res.json({ errorMessage: "没有找到相关患者信息" });
        }
        // If it WAS a PID query and no patient, the patient variable is null, and we will report no prescriptions later.
    }

    // Search for prescriptions using the determined PID (if a patient was found) or the original PID query
    if (searchQuery.pid) {
        prescriptions = await prescriptionsCollection.find({ pid: searchQuery.pid }).sort({ predate: -1 }).toArray();
    } else if (searchQuery.pdate && !patient) {
        // If the query was a date, and no specific patient was tied to it, search prescriptions by date directly.
        // This case was not explicitly handled before, but makes sense if a general date search for prescriptions is intended.
        // However, the UI seems to expect a single patient context. This needs clarification.
        // For now, sticking to PID-based prescription search if a patient context is established.
        // If no patient context, and it was a date query, this part is tricky.
        // The original code would search by patient.pid which would be undefined if patient not found.
        // Let's assume for now if no patient, no prescriptions for that 
