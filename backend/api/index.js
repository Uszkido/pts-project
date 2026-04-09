// require('dotenv').config(); // Vercel injects env automatically
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', msg: 'STRIPPED_SKELETON_V1' });
});

module.exports = app;
