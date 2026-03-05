const https = require('https');

https.get('https://pts-backend-api.vercel.app/health', (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        console.log(`STATUS CODE: ${resp.statusCode}`);
        console.log(`RESPONSE BODY: ${data}`);
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
