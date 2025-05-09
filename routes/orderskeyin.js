// routes/orderskeyin.js
const express = require("express");
const router = express.Router();
// const client = require("../utils/db"); // MongoDB client - Removed as unused in this simplified version
const formatDate = require("../utils/formatDate"); // Assuming formatDate is in the parent directory

router.get("/", (req, res) => {
  res.render("orderskeyin");
});

module.exports = router;

