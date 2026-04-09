const express = require('express');
const app = express();

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', msg: 'ULTRA_SKELETON_RECOMMIT' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', skeleton: true });
});

module.exports = app;