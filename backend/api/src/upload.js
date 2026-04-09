const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with generic keys, but expecting ENV variables for production
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'vexel-demo',
    api_key: process.env.CLOUDINARY_API_KEY || 'dummy_api_key',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'dummy_api_secret'
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'pts-documents',
        allowedFormats: ['jpg', 'png', 'jpeg', 'pdf', 'mp4'],
        // transformation: [{ width: 1000, crop: "limit" }] // Optional resizing
    },
});

const upload = multer({ storage: storage });

module.exports = upload;
