const fs = require('fs');
const path = require('path');

function replaceLocalhostInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceLocalhostInDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            let modified = false;

            // Simple search and replace for fetch calls not yet fixed
            // e.g. fetch('http://localhost:5000/api/v1/...')
            // We want to replace it with:
            // const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            // fetch(`${apiUrl.replace('/api/v1', '')}/api/v1/...`)

            // Just a quick regex to catch the inline string fetches
            if (content.match(/fetch\s*\(\s*['"`]http:\/\/localhost:5000/)) {
                // We'll just replace 'http://localhost:5000' with the template string dynamically
                // But we have to make sure apiUrl is defined in that scope. Too complex for simple replace.
                // Let's just output the files that still have it.
                console.log(`Found hardcoded localhost in: ${fullPath}`);
            }
        }
    }
}

replaceLocalhostInDir(path.join(__dirname, 'src', 'app'));
