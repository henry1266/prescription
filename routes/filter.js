const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager
const { ObjectId } = require("mongodb"); // ObjectId might be needed if updates use it, ensure it"s available

router.get("/", async (req, res) => {
  try {
    const db = dbManager.getDb(); // Get DB instance from manager
    const prescriptions = db.collection("prescriptions");
    const patients = db.collection("patients");

    const nonZeroAndNotEmptyPrem = await prescriptions
      .find({ pretype: "04", prem: { $nin: ["0", 0], $ne: null, $exists: true } })
      .sort({ predate: 1 })
      .toArray();

    const nonZeroAndNotEmptyPremCount = nonZeroAndNotEmptyPrem.length;

    let minDate = null;
    if (nonZeroAndNotEmptyPrem.length > 0) {
        minDate = new Date(
          Math.min(
            ...nonZeroAndNotEmptyPrem.map(p => {
              const predateStr = p.predate.toString();
              const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`;
              return new Date(formattedPredate);
            })
          )
        );
    }

    for (let prescription of nonZeroAndNotEmptyPrem) {
      const patient = await patients.findOne({ pid: prescription.pid });
      prescription.pname = patient ? patient.pname : "未知姓名";

      if (prescription.predate) {
        prescription.formattedPredate = `${prescription.predate.slice(0, 4)}-${prescription.predate.slice(4, 6)}-${prescription.predate.slice(6, 8)}`;
      } else {
        prescription.formattedPredate = "N/A";
      }

      if (prescription.predate && prescription.preday && prescription.precount) {
        const predateStr = prescription.predate.toString();
        const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`;
        const predate = new Date(formattedPredate);
        const totalDays = prescription.preday * prescription.precount;
        const calculatedDate = new Date(predate);
        calculatedDate.setDate(predate.getDate() + totalDays);

        if (!isNaN(calculatedDate.getTime())) {
          prescription.calculatedDate = calculatedDate.toISOString().split("T")[0];
          const today = new Date();
          const remainingDays = Math.ceil((calculatedDate - today) / (1000 * 60 * 60 * 24));
          if (remainingDays <= 0) {
            await prescriptions.updateOne(
              { _id: new ObjectId(prescription._id) }, // Ensure ObjectId is used if _id is an ObjectId
              { $set: { prem: "0" } }
            );
            console.log(`Updated prem to 0 for prescription ID: ${prescription._id}`);
          }
        } else {
          prescription.calculatedDate = "N/A";
        }
        if (minDate) {
            const diffFromMinDate = Math.ceil((predate - minDate) / (1000 * 60 * 60 * 24));
            prescription.diffFromMinDate = diffFromMinDate;
        } else {
            prescription.diffFromMinDate = "N/A";
        }
      } else {
        prescription.calculatedDate = "N/A";
        prescription.diffFromMinDate = "N/A";
      }
    }

    const remainingPrescriptions = await prescriptions
      .find({ pretype: "04", $or: [{ prem: "0" }, { prem: null }, { prem: { $exists: false } }] })
      .sort({ predate: 1 })
      .toArray();

    const remainingPrescriptionsCount = remainingPrescriptions.length;

    for (let prescription of remainingPrescriptions) {
      const patient = await patients.findOne({ pid: prescription.pid });
      prescription.pname = patient ? patient.pname : "未知姓名";

      if (prescription.predate) {
        prescription.formattedPredate = `${prescription.predate.slice(0, 4)}-${prescription.predate.slice(4, 6)}-${prescription.predate.slice(6, 8)}`;
      } else {
        prescription.formattedPredate = "N/A";
      }

      if (prescription.predate && prescription.preday && prescription.precount) {
        const predateStr = prescription.predate.toString();
        const formattedPredate = `${predateStr.slice(0, 4)}-${predateStr.slice(4, 6)}-${predateStr.slice(6, 8)}`;
        const predate = new Date(formattedPredate);
        const totalDays = prescription.preday * prescription.precount;
        const calculatedDate = new Date(predate);
        calculatedDate.setDate(predate.getDate() + totalDays);

        if (!isNaN(calculatedDate.getTime())) {
          prescription.calculatedDate = calculatedDate.toISOString().split("T")[0];
        } else {
          prescription.calculatedDate = "N/A";
        }
      } else {
        prescription.calculatedDate = "N/A";
      }
    }

    res.render("filter", { 
      nonZeroAndNotEmptyPrem, 
      remainingPrescriptions, 
      nonZeroAndNotEmptyPremCount, 
      remainingPrescriptionsCount 
    });
  } catch (error) {
    console.error("Error in /filter route:", error);
    res.status(500).send("Server error in filter route");
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

