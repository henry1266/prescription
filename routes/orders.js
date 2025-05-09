const express = require("express");
const router = express.Router();
const dbManager = require("../utils/database"); // Use the new database manager

// GET route to fetch purchase orders
router.get("/", async (req, res) => {
  try {
    const db = dbManager.getDb("inventory"); // Get 'inventory' DB instance
    const orderId = req.query.orderId;
    let purchaseOrders;

    if (orderId) {
      purchaseOrders = await db.collection("purchaseOrders").find({ poid: orderId }).sort({ poid: 1 }).toArray();
    } else {
      purchaseOrders = await db.collection("purchaseOrders").find().sort({ poid: 1 }).toArray();
    }

    purchaseOrders = purchaseOrders.map(order => {
      order.totalCost = order.items.reduce((sum, item) => sum + parseFloat(item.dtotalCost), 0);
      return order;
    });

    res.render("orders", { purchaseOrders });
  } catch (error) {
    console.error("Error occurred in GET /orders:", error);
    res.status(500).json({ error: error.message });
  }
  // No client.close() here, connection is managed centrally
});

// GET route to render the edit page
router.get("/edit/:poid", async (req, res) => {
  try {
    const db = dbManager.getDb("inventory"); // Get 'inventory' DB instance
    const poid = req.params.poid;
    const order = await db.collection("purchaseOrders").findOne({ poid: poid });

    if (order) {
      res.render("editOrder", { order });
    } else {
      res.status(404).send("Order not found");
    }
  } catch (error) {
    console.error("Error occurred in GET /orders/edit/:poid:", error);
    res.status(500).json({ error: error.message });
  }
  // No client.close() here, connection is managed centrally
});

// POST route to handle order update
router.post("/update/:poid", async (req, res) => {
  try {
    const db = dbManager.getDb("inventory"); // Get 'inventory' DB instance
    const poid = req.params.poid;
    const updatedOrder = req.body;

    await db.collection("purchaseOrders").updateOne({ poid: poid }, { $set: updatedOrder });

    res.redirect("/orders");
  } catch (error) {
    console.error("Error occurred in POST /orders/update/:poid:", error);
    res.status(500).json({ error: error.message });
  }
  // No client.close() here, connection is managed centrally
});

module.exports = router;

