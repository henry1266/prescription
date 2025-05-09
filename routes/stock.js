// routes/stock.js
const express = require("express");
const router = express.Router();

// This route currently only renders the stock view and does not require database access directly.
// The unused formatDate require was also removed.

router.get("/", (req, res) => {
  res.render("stock"); // Render the stock.ejs view
});

module.exports = router;

