require("dotenv").config(); // Load environment variables from .env file

const express = require("express");
const path = require("path");
const http = require("http");
const dbManager = require("./utils/database");
// const appHelper = require("./utils/appHelper"); // No longer needed, functionality moved to prescriptionService
const prescriptionService = require("./services/prescriptionService"); // Import prescriptionService

const app = express();
const port = process.env.PORT || 3001;

const server = http.createServer(app);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Import Routers
const formatDate = require("./utils/formatDate");
const calculateRouter = require("./routes/calculate");
const searchByDateRouter = require("./routes/searchByDate");
const customerTimeChartRouter = require("./routes/customerTimeChart");
const searchPrescriptionsRouter = require("./routes/searchPrescriptions");
const searchPrescriptionRouter = require("./routes/searchPrescription");
const searchByInsuranceCodeRouter = require("./routes/searchByInsuranceCode");
const updatePrescriptionRouter = require("./routes/updatePrescription");
const updatePatientRouter = require("./routes/updatePatient");
const getReportsRouter = require("./routes/getReports");
const getReportsAgeRouter = require("./routes/getReportsAge");
const calendarRoute = require("./routes/calendar");
const weeksRoute = require("./routes/weeks");
const dashboardRoute = require("./routes/dashboard");
const managePrescriptionsRoute = require("./routes/managePrescriptions");
const managePrescriptions2Route = require("./routes/managePrescriptions2");
const ordersRouter = require("./routes/orders");
const ordersresultRouter = require("./routes/ordersresult");
const orderskeyinRouter = require("./routes/orderskeyin");
const stockRouter = require("./routes/stock");
const ganttRouter = require("./routes/gantt");
const filterRouter = require("./routes/filter");
const resultRouter = require("./routes/result");

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/search", (req, res) => {
  res.render("search");
});

app.get("/search2", (req, res) => {
  res.render("search2");
});

app.use("/calculate", calculateRouter);
app.use("/searchByDate", searchByDateRouter);
app.use("/customer-time-chart", customerTimeChartRouter);
app.use("/searchPrescriptions", searchPrescriptionsRouter);
app.use("/searchPrescription", searchPrescriptionRouter);
app.use("/searchByInsuranceCode", searchByInsuranceCodeRouter);
app.use("/updatePrescription", updatePrescriptionRouter);
app.use("/updatePatient", updatePatientRouter);
app.use("/getReports", getReportsRouter);
app.use("/getReportsAge", getReportsAgeRouter);
app.use("/calendar", calendarRoute);
app.use("/weeks", weeksRoute);
app.use("/dashboard", dashboardRoute);
app.use("/manageprescription", managePrescriptionsRoute);
app.use("/manageprescription2", managePrescriptions2Route);
app.use("/orders", ordersRouter);
app.use("/ordersresult", ordersresultRouter);
app.use("/orderskeyin", orderskeyinRouter);
app.use("/stock", stockRouter);
app.use("/gantt", ganttRouter);
app.use("/filter", filterRouter);
app.use("/result", resultRouter);

app.post("/delete/:id", async (req, res) => {
  const prescriptionId = req.params.id;
  try {
    // Use prescriptionService for deletion
    const result = await prescriptionService.deletePrescription(prescriptionId);
    // The service now returns { success: true, message: "..." } or throws an error
    res.status(200).send({ message: result.message }); 
  } catch (e) {
    console.error("Error deleting prescription in app.js:", e.message);
    // Check if it's a "not found" type error from the service
    if (e.message.toLowerCase().includes("not found")) {
        res.status(404).send({ message: e.message });
    } else {
        res.status(500).send({ message: e.message || "Server error, unable to delete prescription" });
    }
  }
});

async function startServer() {
  try {
    await dbManager.connectToServer();
    server.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

process.on("SIGINT", async () => {
  console.log("SIGINT signal received: closing HTTP server and DB connection");
  server.close(async () => {
    console.log("HTTP server closed");
    await dbManager.closeConnection();
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server and DB connection");
  server.close(async () => {
    console.log("HTTP server closed");
    await dbManager.closeConnection();
    process.exit(0);
  });
});

