import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

console.log("[DB] USER=", process.env.DB_USER);
console.log("[DB] PASS set? ", process.env.DB_PASSWORD ? "YES" : "NO"); // <-- debería ser YES
console.log("[DB] NAME=", process.env.DB_NAME);

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "12345678", // si esto queda vacío, MySQL verá "using password: NO"
  database: process.env.DB_NAME ?? "ritmofit",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
