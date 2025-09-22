const mysql = require('mysql2');
require('dotenv').config();

// Create connection using traditional callback style to match your controller
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Test connection function
const testConnection = () => {
  return new Promise((resolve, reject) => {
    db.connect((err) => {
      if (err) {
        console.error('Database connection failed:', err.message);
        reject(err);
      } else {
        console.log('Database connected successfully');
        resolve();
      }
    });
  });
};

module.exports = { db, testConnection };

// const mysql = require('mysql2');
// require('dotenv').config();

// // Create connection using traditional callback style to match your controller
// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT,
//   // Add connection options for better stability
//   acquireTimeout: 60000,
//   timeout: 60000,
//   reconnect: true
// });

// // Handle connection errors
// db.on('error', function(err) {
//   console.error('Database connection error:', err);
//   if(err.code === 'PROTOCOL_CONNECTION_LOST') {
//     console.log('Database connection was closed. Attempting to reconnect...');
//     // Handle reconnection if needed
//   }
// });

// // Test connection function
// const testConnection = () => {
//   return new Promise((resolve, reject) => {
//     db.connect((err) => {
//       if (err) {
//         console.error('❌ Database connection failed:', err.message);
//         console.error('Connection details:', {
//           host: process.env.DB_HOST,
//           user: process.env.DB_USER,
//           database: process.env.DB_NAME,
//           port: process.env.DB_PORT
//         });
//         reject(err);
//       } else {
//         console.log('✅ Database connected successfully');
//         resolve();
//       }
//     });
//   });
// };

// module.exports = { db, testConnection };