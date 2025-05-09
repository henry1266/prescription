// routes/searchByDate.js
const express = require('express');
const router = express.Router();
const client = require('../utils/db'); // MongoDB client
const formatDate = require('../utils/formatDate'); // 假設 formatDate 在上層目錄

router.get('/', (req, res) => {
  res.render('stock'); // Render the stock.ejs view
});

module.exports = router;
