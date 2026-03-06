const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const policeRoutes = require('./routes/police');
const consumerRoutes = require('./routes/consumers');
const transferRoutes = require('./routes/transfers');
const telecomRoutes = require('./routes/telecom');
const incidentRoutes = require('./routes/incidents');
const vendorRoutes = require('./routes/vendors');
const registryRoutes = require('./routes/registry');
const passportRoutes = require('./routes/passports');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/police', policeRoutes);
app.use('/api/v1/consumers', consumerRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/telecom', telecomRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/registry', registryRoutes);
app.use('/api/v1/passports', passportRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'PTS Backend is running' });
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
