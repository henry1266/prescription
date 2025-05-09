const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // MongoDB client

// GET route to fetch purchase orders
router.get('/', async (req, res) => {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db("inventory");
    const orderId = req.query.orderId;
    let purchaseOrders;

    console.log('Query parameters:', req.query);

    if (orderId) {
      console.log(`Searching for orderId: ${orderId}`);
      purchaseOrders = await db.collection("purchaseOrders").find({ poid: orderId }).sort({ poid: 1 }).toArray();
    } else {
      console.log('No orderId provided, fetching all purchase orders');
      purchaseOrders = await db.collection("purchaseOrders").find().sort({ poid: 1 }).toArray();
    }

    // Calculate total cost for each order
    purchaseOrders = purchaseOrders.map(order => {
      order.totalCost = order.items.reduce((sum, item) => sum + parseFloat(item.dtotalCost), 0);
      return order;
    });

    console.log('Purchase orders retrieved:', purchaseOrders);

    res.render('orders', { purchaseOrders });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: error.message });
  } finally {
    console.log('Closing MongoDB connection...');
    await client.close();
  }
});

// GET route to render the edit page
router.get('/edit/:poid', async (req, res) => {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db("inventory");
    const poid = req.params.poid;

    console.log(`Fetching order with poid: ${poid}`);
    const order = await db.collection("purchaseOrders").findOne({ poid: poid });

    if (order) {
      res.render('editOrder', { order });
    } else {
      res.status(404).send('Order not found');
    }
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: error.message });
  } finally {
    console.log('Closing MongoDB connection...');
    await client.close();
  }
});

// POST route to handle order update
router.post('/update/:poid', async (req, res) => {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db("inventory");
    const poid = req.params.poid;
    const updatedOrder = req.body;

    console.log(`Updating order with poid: ${poid}`);
    await db.collection("purchaseOrders").updateOne({ poid: poid }, { $set: updatedOrder });

    console.log('Order updated successfully');
    res.redirect('/orders');
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: error.message });
  } finally {
    console.log('Closing MongoDB connection...');
    await client.close();
  }
});

module.exports = router;