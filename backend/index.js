const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', msg: 'ULTRA_SKELETON_FIXED_V2' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', build: 'v1.1.0' });
});

module.exports = app;
