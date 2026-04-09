/**
 * PTS SENTINEL — Sovereign ELA Forensics Engine
 * ================================================
 * Implements Error Level Analysis (ELA) entirely in Node.js using Sharp (C++ native bindings).
 * Inspired by open-source forensics tools (fakeimagedetector, Ghiro, Document_Forgery_Detection).
 *
 * How ELA Works:
 * 1. Download the image from the supplied URL.
 * 2. Re-compress it at a known JPEG quality (75%).
 * 3. Get the raw pixel buffers of BOTH images (original vs re-compressed).
 * 4. Calculate per-pixel absolute difference between them.
 * 5. Tampered regions show HIGH difference (they were already heavily compressed and don't change much more).
 * 6. Authentic regions show LOW, uniform difference.
 * 7. Calculate a tamper score from the statistical distribution of differences.
 */

const axios = require('axios');
const crypto = require('crypto');

// Lazy-load sharp to avoid native module boot-time issues on Vercel
let sharp = null;
function getSharp() {
    if (!sharp) {
        try { sharp = require('sharp'); } catch (e) { console.error('⚠️ sharp unavailable:', e.message); }
    }
    return sharp;
}

/**
 * Downloads an image from a URL and returns a raw buffer.
 */
const fetchImageBuffer = async (url) => {
    if (url.startsWith('data:')) {
        const base64Data = url.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    }
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    return Buffer.from(response.data);
};

/**
 * Core ELA Analysis Function.
 * @param {string} imageUrl - URL or base64 data URI of the image to scan.
 * @returns {Promise<{ isLikelyFaked: boolean, tamperScore: number, confidence: string, verdict: string, exifAnomalies: string[], sha256: string }>}
 */
const analyzeImageELA = async (imageUrl) => {
    if (!imageUrl) {
        return { isLikelyFaked: false, tamperScore: 0, confidence: 'SKIPPED', verdict: 'No image provided for ELA scan.' };
    }

    try {
        console.log('[ELA Engine] Downloading image for forensic scan...');
        const originalBuffer = await fetchImageBuffer(imageUrl);

        // ─── Step 1: Hash the original for fingerprint ──────────────────────
        const sha256 = crypto.createHash('sha256').update(originalBuffer).digest('hex');

        const currentSharp = getSharp();
        if (!currentSharp) throw new Error("Sharp forensics engine is unavailable");

        // ─── Step 2: Get original pixel data (resized to 512px for speed) ──
        const { data: originalPixels, info } = await currentSharp(originalBuffer)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .toFormat('raw', { depth: 'uchar' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        // ─── Step 3: Re-compress at JPEG quality 75 ─────────────────────────
        const recompressedBuffer = await currentSharp(originalBuffer)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75, mozjpeg: true })
            .toBuffer();

        // ─── Step 4: Get recompressed pixel data ────────────────────────────
        const { data: recompPixels } = await currentSharp(recompressedBuffer)
            .toFormat('raw', { depth: 'uchar' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        // ─── Step 5: Pixel-by-pixel difference analysis ─────────────────────
        const totalPixels = originalPixels.length;
        let totalDiff = 0;
        let highDiffPixels = 0;
        const HIGH_DIFF_THRESHOLD = 25; // pixels with diff > 25 are suspects

        for (let i = 0; i < Math.min(totalPixels, recompPixels.length); i++) {
            const diff = Math.abs(originalPixels[i] - recompPixels[i]);
            totalDiff += diff;
            if (diff > HIGH_DIFF_THRESHOLD) highDiffPixels++;
        }

        const avgDiff = totalDiff / totalPixels;
        const highDiffRatio = highDiffPixels / (totalPixels / 3); // divide by 3 for RGB channels

        // ─── Step 6: EXIF Metadata Anomaly Detection ────────────────────────
        const exifAnomalies = [];
        try {
            const exifr = require('exifr');
            const exif = await exifr.parse(originalBuffer, {
                pick: ['Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal', 'ModifyDate', 'GPSLatitude', 'CreatorTool']
            });

            if (exif) {
                if (exif.Software && /(photoshop|gimp|paint|affinity|canva|snapseed)/i.test(exif.Software)) {
                    exifAnomalies.push(`Editing software detected in EXIF: "${exif.Software}"`);
                }
                if (exif.CreatorTool && /(photoshop|gimp|illustrator)/i.test(exif.CreatorTool)) {
                    exifAnomalies.push(`EXIF CreatorTool reveals design software: "${exif.CreatorTool}"`);
                }
                if (exif.ModifyDate && exif.DateTimeOriginal) {
                    const orig = new Date(exif.DateTimeOriginal);
                    const mod = new Date(exif.ModifyDate);
                    if (mod > orig && (mod - orig) > 60000) { // more than 1 minute gap
                        exifAnomalies.push(`Image was modified AFTER original capture. (Created: ${orig.toISOString().slice(0, 10)}, Modified: ${mod.toISOString().slice(0, 10)})`);
                    }
                }
                if (!exif.Make && !exif.Model) {
                    exifAnomalies.push('No camera make/model in EXIF — image may be a screenshot or digital creation.');
                }
            } else {
                exifAnomalies.push('No EXIF metadata found — genuine receipts typically contain camera/scanner metadata.');
            }
        } catch (exifErr) {
            exifAnomalies.push('EXIF extraction failed — metadata may have been deliberately stripped.');
        }

        // ─── Step 7: Compute Final Tamper Score (0-100) ──────────────────────
        // Weights:
        //   40% — ELA average pixel difference (high = suspicious)
        //   40% — ratio of high-diff pixels
        //   20% — EXIF anomaly penalty
        const elaScore = Math.min(100, (avgDiff / 15) * 40);           // 0-40 pts
        const diffRatioScore = Math.min(40, highDiffRatio * 2 * 40);   // 0-40 pts
        const exifScore = Math.min(20, exifAnomalies.length * 7);      // 0-20 pts

        const tamperScore = Math.round(elaScore + diffRatioScore + exifScore);

        // ─── Step 8: Verdict ─────────────────────────────────────────────────
        let confidence, verdict, isLikelyFaked;

        if (tamperScore >= 70) {
            isLikelyFaked = true;
            confidence = 'HIGH';
            verdict = `Image FAILED forensic ELA scan. High compression artifact inconsistency detected (${tamperScore}/100 tamper score). This image shows hallmarks of digital manipulation — cloned regions, Photoshop edits, or screenshot-based forgery.`;
        } else if (tamperScore >= 40) {
            isLikelyFaked = true;
            confidence = 'MEDIUM';
            verdict = `Image shows SUSPICIOUS patterns (${tamperScore}/100 tamper score). Some pixel regions show inconsistent compression artifacts. Manual admin review recommended before approving this document.`;
        } else {
            isLikelyFaked = false;
            confidence = 'LOW';
            verdict = `Image appears authentic (${tamperScore}/100 tamper score). ELA pixel analysis shows uniform compression distribution typical of genuine photographs and scanned documents.`;
        }

        console.log(`[ELA Engine] Scan complete. TamperScore: ${tamperScore}/100. Verdict: ${confidence}`);

        return {
            isLikelyFaked,
            tamperScore,
            confidence,
            verdict,
            exifAnomalies,
            sha256,
            stats: {
                avgPixelDiff: Math.round(avgDiff * 100) / 100,
                highDiffPixelRatio: Math.round(highDiffRatio * 10000) / 100,
                totalPixelsScanned: Math.min(totalPixels, recompPixels.length)
            }
        };

    } catch (err) {
        console.error('[ELA Engine] Critical failure:', err.message);
        return {
            isLikelyFaked: false,
            tamperScore: 0,
            confidence: 'ERROR',
            verdict: `ELA Engine encountered an error: ${err.message}. Skipping forensic check.`,
            exifAnomalies: [],
            sha256: null
        };
    }
};

module.exports = { analyzeImageELA };
