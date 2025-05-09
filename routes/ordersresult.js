const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

// POST route to handle form submission
router.post("/", async (req, res) => {
  try {
    const db = dbManager.getDb("inventory"); // Get 'inventory' DB instance
    const order = req.body;

    await db.collection("purchaseOrders").insertOne(order);

    res.render("ordersresult", { order });
  } catch (error) {
    console.error("Error occurred in POST /ordersresult:", error);
    res.status(500).json({ error: error.message });
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

