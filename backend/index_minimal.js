require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', message: 'MINIMAL BOOT SUCCESSFUL', time: new Date() });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'MINIMAL HEALTH SUCCESSFUL' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Minimal server running on port ${PORT}`);
});

module.exports = app;
