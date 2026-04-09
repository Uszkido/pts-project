require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', msg: 'HEARTBEAT FROM API/INDEX.JS' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', source: 'DIRECT_API_FILE' });
});

module.exports = app;
