const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src_backend', 'routes');
const files = fs.readdirSync(dir);

files.forEach(file => {
    if (file.endsWith('.js')) {
        const fullPath = path.join(dir, file);
        let src = fs.readFileSync(fullPath, 'utf8');

        // Fix the hardcoded JWT_SECRET to check env first
        src = src.replace(/const JWT_SECRET = 'supersecret_pts_dev_key';/g, "const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pts_dev_key';");

        // Fix sendStatus(401) to JSON
        src = src.replace(/if \(\!token\) return res\.sendStatus\(401\);/g, "if (!token) return res.status(401).json({error: 'Unauthorized'});");

        // Fix sendStatus(403) to JSON
        src = src.replace(/if \(err\) return res\.sendStatus\(403\);/g, "if (err) return res.status(403).json({error: 'Forbidden'});");

        fs.writeFileSync(fullPath, src);
        console.log('Fixed auth in', fullPath);
    }
});
