const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // MongoDB client


// POST route to handle form submission
router.post('/', async (req, res) => {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db("inventory");
    const order = req.body;

    console.log('Inserting order into MongoDB:', order);
    await db.collection("purchaseOrders").insertOne(order);

    console.log('Order inserted successfully');
    res.render('ordersresult', { order });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: error.message });
  } finally {
    console.log('Closing MongoDB connection...');
    await client.close();
  }
});

module.exports = router;
