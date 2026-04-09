const express = require('express');
const app = express();

app.get('/ping', (req, res) => {
    res.send('PONG_V1_DIRECT');
});

module.exports = app;
