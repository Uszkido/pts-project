const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', msg: 'ATOMIC_BOOT_SUCCESS' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', routes: ['ping', 'health'] });
});

// module.exports = app;
// IMPORTANT: Many Vercel projects expect BOTH export and optional app.listen for local dev
if (require.main === module) {
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`Listening on ${port}`));
}
module.exports = app;