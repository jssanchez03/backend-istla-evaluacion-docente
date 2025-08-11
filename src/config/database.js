const mysql = require('mysql2/promise');
require('dotenv').config();

// Base de datos de lectura (Instituto)
const dbLectura = mysql.createPool({
  host: process.env.DB_LECTURA_HOST,
  port: process.env.DB_LECTURA_PORT,
  user: process.env.DB_LECTURA_USER,
  password: process.env.DB_LECTURA_PASSWORD,
  database: process.env.DB_LECTURA_NAME
});

// Base de datos de escritura (Sistema de Evaluaciones)
const dbEscritura = mysql.createPool({
  host: process.env.DB_ESCRITURA_HOST,
  port: process.env.DB_ESCRITURA_PORT,
  user: process.env.DB_ESCRITURA_USER,
  password: process.env.DB_ESCRITURA_PASSWORD,
  database: process.env.DB_ESCRITURA_NAME
});

module.exports = {
  dbLectura,
  dbEscritura
};
