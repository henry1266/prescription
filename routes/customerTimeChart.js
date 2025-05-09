const express = require("express");
const router = express.Router();
const formatDate = require("../utils/formatDate"); // Assuming formatDate is in the parent directory
const dbManager = require("../utils/database"); // Use the new database manager

router.get("/", async (req, res) => {
  const selectedDate1 = req.query.predate; // Get date from query parameters
  if (!selectedDate1) {
    return res.status(400).send("Missing necessary date parameter predate");
  }

  const formattedDate1 = formatDate(selectedDate1);

  try {
    const db = dbManager.getDb(); // Get DB instance from manager
    const prescriptionsCollection = db.collection("prescriptions");

    // Query all customer arrival times for the day
    const prescriptions = await prescriptionsCollection
      .find({ predate: formattedDate1 })
      .project({ presec: 1 }) // Only extract the presec field
      .toArray();

    // Extract time data
    const times = prescriptions.map(prescription => prescription.presec);
    console.log(formattedDate1);
    res.render("customerTimeChart", { times, formattedDate1 });
  } catch (e) {
    console.error("Error querying data:", e);
    res.status(500).send("Query failed");
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

