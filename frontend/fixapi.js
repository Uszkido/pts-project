const fs = require('fs');
const path = require('path');

function replaceAPI(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.vercel' && file !== '.next') {
                replaceAPI(fullPath);
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            let src = fs.readFileSync(fullPath, 'utf8');
            let original = src;

            // Replace localhosts
            src = src.replace(/http:\/\/localhost:5000\/api\/v1/g, 'https://pts-backend-api.vercel.app/api/v1');
            // Replace the old vexel domain
            src = src.replace(/https:\/\/pts-vexel\.vercel\.app\/api\/v1/g, 'https://pts-backend-api.vercel.app/api/v1');

            if (src !== original) {
                fs.writeFileSync(fullPath, src);
                console.log('Fixed', fullPath);
            }
        }
    });
}
replaceAPI(path.join(__dirname, 'src'));
