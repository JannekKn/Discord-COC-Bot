var mysql = require('mysql');
const { dbHost, dbUser, dbPass, dbName, dbPort } = require('./config.json');

var con = mysql.createConnection({
  host: dbHost,
  user: dbUser,
  password: dbPass,
  database: dbName,
  port: dbPort
});

con.connect(function (err) {
  if (err) throw err;
  console.log("Connected to Databse!");
});

module.exports = con;