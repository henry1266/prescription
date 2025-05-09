// utils/database.js
const { MongoClient } = require("mongodb");

// Configuration will be read from environment variables later
// For now, use a placeholder or a default development URI
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017"; 
const dbName = process.env.DB_NAME || "pharmacy";

const client = new MongoClient(uri, {
  useNewUrlParser: true, // Although deprecated, good to be aware if older examples are seen
  useUnifiedTopology: true, // Ensures use of the new Server Discover and Monitoring engine
});

let dbInstance = null;

async function connectToServer() {
  if (dbInstance) {
    console.log("Database already connected.");
    return dbInstance;
  }
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB server.");
    dbInstance = client.db(dbName);
    return dbInstance;
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    // Exit process with failure in a real app, or handle more gracefully
    process.exit(1);
  }
}

function getDb() {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call connectToServer first.");
  }
  return dbInstance;
}

async function closeConnection() {
  if (client && client.topology && client.topology.isConnected()) {
    await client.close();
    console.log("MongoDB connection closed.");
  }
}

module.exports = { connectToServer, getDb, closeConnection };

