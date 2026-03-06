const https = require('https');

https.get('https://pts-frontend-url-here/vendor/dashboard', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        if (data.includes('Active Inventory') || data.includes('Public Trust Index')) {
            console.log('✅ Frontend has the new code!');
        } else {
            console.log('❌ Frontend still has the old code.');
        }
    });
});
