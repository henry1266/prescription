// utils/database.js
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME; // Default database name

let client;
let dbInstance; // Holds the default database instance

module.exports = {
  connectToServer: async function() {
    if (!uri) {
      throw new Error("MONGODB_URI not defined in .env file");
    }
    // dbName is for the default database, can be omitted if only specific dbs are used via getDb(name)
    // However, good to have a default defined for general use.
    if (!dbName) {
      console.warn("DB_NAME for default database not defined in .env file. Only specific databases can be accessed via getDb(specificName).");
    }
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
      await client.connect();
      if (dbName) {
        dbInstance = client.db(dbName); // Initialize default DB instance
        console.log(`Successfully connected to MongoDB and default database set to: ${dbInstance.databaseName}`);
      } else {
        console.log("Successfully connected to MongoDB. No default DB_NAME specified, use getDb(specificName) to access databases.");
      }
    } catch (err) {
      console.error("Failed to connect to MongoDB", err);
      throw err;
    }
  },

  getDb: function(specificDbName) {
    if (!client || !client.topology || !client.topology.isConnected()) {
        throw new Error("MongoDB client not connected. Call connectToServer first.");
    }
    if (specificDbName) {
        return client.db(specificDbName);
    }
    // If no specificDbName, return the default initialized dbInstance
    if (!dbInstance) {
        if (dbName) { // If default dbName was defined but instance is missing (should not happen after connectToServer)
             console.warn("Default dbInstance was not initialized correctly, attempting to get default DB again.");
             return client.db(dbName);
        }
        throw new Error("Default database instance not available (and no specificDbName provided). Ensure DB_NAME is in .env or provide a specificDbName.");
    }
    return dbInstance;
  },

  closeConnection: async function() {
    if (client) {
      await client.close();
      console.log("MongoDB connection closed.");
      client = null;
      dbInstance = null;
    }
  }
};
