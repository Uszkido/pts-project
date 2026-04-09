const fs = require('fs');
const path = require('path');

// Fix SW
const swPath = path.join(__dirname, 'src', '..', 'public', 'sw.js');
let swSrc = fs.readFileSync(swPath, 'utf8');

// The block to remove
const apiBlockStart = "// API calls \u2014 network first, fail gracefully";
const apiBlockRegex = /\/\/ API calls — network first, fail gracefully[\s\S]*?return;\n    }/;
swSrc = swSrc.replace(apiBlockRegex, '');

fs.writeFileSync(swPath, swSrc);
console.log('Fixed sw.js');

// Fix Dashboard Error handlers
function fixDashboards(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixDashboards(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            let src = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Redirect on 401/403 unconditionally!
            // Search for typical dashboard fetch pattern
            if (src.includes('dashRes.json()') || src.includes('.json()')) {
                if (src.includes(`err.message.includes('401') || err.message.includes('403')`)) {
                    src = src.replace(/if \(err\.message\.includes\('401'\) \|\| err\.message\.includes\('403'\)\) \{/g, `if (err.message.includes('Unauthorized') || err.message.includes('Forbidden') || err.message.includes('401') || err.message.includes('403')) {\n                localStorage.removeItem('pts_token');`);
                    modified = true;
                }
            }
            if (modified) {
                fs.writeFileSync(fullPath, src);
                console.log('Fixed error handling in', fullPath);
            }
        }
    });
}

fixDashboards(path.join(__dirname, 'src'));
