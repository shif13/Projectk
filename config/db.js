const mysql = require('mysql2');
require('dotenv').config();

let db;

function handleDisconnect() {
  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    connectTimeout: 10000, // 10 seconds
  });

  // Connect to MySQL
  db.connect((err) => {
    if (err) {
      console.error('❌ MySQL connection error:', err.message);
      setTimeout(handleDisconnect, 2000); // Retry after 2 seconds
    } else {
      console.log('✅ MySQL connected successfully');
    }
  });

  // Handle unexpected errors and reconnect if connection is lost
  db.on('error', (err) => {
    console.error('⚠️ MySQL error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('🔄 Reconnecting to MySQL...');
      handleDisconnect();
    } else {
      throw err;
    }
  });

  // Keep connection alive to prevent idle timeout
  setInterval(() => {
    if (db && db.state === 'authenticated') {
      db.ping((err) => {
        if (err) console.error('⚠️ MySQL ping failed:', err.message);
      });
    }
  }, 60000); // ping every 60 seconds
}

// Initialize connection on startup
handleDisconnect();

// Optional test function for startup verification
const testConnection = () => {
  return new Promise((resolve, reject) => {
    db.query('SELECT 1', (err) => {
      if (err) {
        console.error('❌ Database connection test failed:', err.message);
        reject(err);
      } else {
        console.log('✅ Database connection verified');
        resolve();
      }
    });
  });
};

module.exports = { db, testConnection };
