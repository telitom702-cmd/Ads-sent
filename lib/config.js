const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "config.js");
if (!fs.existsSync(configPath)) {
  throw new Error("config.js not found. Copy config.js.example to config.js and set your values.");
}

const config = require(configPath);

module.exports = config;
