// db.js
const { MongoClient } = require('mongodb');

const uri = "mongodb://192.168.68.79:27017"; // 替換為你的 MongoDB URI
const client = new MongoClient(uri);
async function connectToDatabase() {
    if (!client.isConnected()) await client.connect();
    return client.db('pharmacy');
  }

module.exports = connectToDatabase;