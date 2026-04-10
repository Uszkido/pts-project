const https = require('https');

https.get('https://api.telegram.org/bot8530641894:AAEdroJlNJVmC_uttMz5sLpiA8UwlJA1KDY/deleteWebhook', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Delete Webhook:', data));
}).on('error', (e) => console.error(e));
