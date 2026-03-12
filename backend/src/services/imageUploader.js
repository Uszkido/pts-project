const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a image from a URL (e.g. from Telegram/WhatsApp) to Cloudinary
 */
const uploadFromUrl = async (url) => {
    try {
        const result = await cloudinary.uploader.upload(url, {
            folder: 'pts-bot-uploads',
            resource_type: 'auto'
        });
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        return null;
    }
};

/**
 * Uploads a image from a Buffer to Cloudinary
 */
const uploadFromBuffer = (buffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'pts-bot-uploads' },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        uploadStream.end(buffer);
    });
};

module.exports = { uploadFromUrl, uploadFromBuffer };
