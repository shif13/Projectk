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

  db.connect((err) => {
    if (err) {
      console.error('❌ Error connecting to MySQL:', err.message);
      // Retry connection after 2 seconds
      setTimeout(handleDisconnect, 2000);
    } else {
      console.log('✅ MySQL connected successfully');
    }
  });

  // Handle unexpected connection loss
  db.on('error', (err) => {
    console.error('⚠️ MySQL error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('🔄 Attempting to reconnect to MySQL...');
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

// Initialize connection when app starts
handleDisconnect();

// Optional test function for startup
const testConnection = () => {
  return new Promise((resolve, reject) => {
    db.query('SELECT 1', (err) => {
      if (err) {
        console.error('❌ Database connection failed:', err.message);
        reject(err);
      } else {
        console.log('✅ Database connection verified');
        resolve();
      }
    });
  });
};

module.exports = { db, testConnection };
