const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // Locked to localhost only - no network access

// Security: No CORS needed since frontend is served from same origin
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// Path to our local JSON database
const dbPath = path.join(__dirname, 'localtube-db.json');

// Initialize database with default empty values if not exists
const initDb = () => {
    if (!fs.existsSync(dbPath)) {
        const defaultDb = {
            customFolders: [],
            history: {}, // Map videoId -> resumeTimestamp
            likedVideos: [],
            playlists: {}
        };
        fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
};

let db = initDb();

// Save helper
const saveDb = () => {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
};

// Possible directories where downloaded videos might be
// Get the combined list of default and custom directories to scan
const getDirsToScan = () => {
    const defaultDirs = [
        path.join(os.homedir(), 'Downloads'),
        path.join(os.homedir(), 'Desktop', 'LocalTube', 'videos'),
        process.cwd()
    ];
    // Add custom folders from the state DB
    const allDirs = new Set([...defaultDirs, ...(db.customFolders || [])]);
    return Array.from(allDirs);
};

// Helper to check if file is a video
const isVideo = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    return ['.mp4', '.mkv', '.webm', '.avi', '.mov'].includes(ext);
};

// State to hold video paths mapped by a unique ID
let videoCache = [];

// Generate a stable video ID from the file path (never changes between scans)
const getVideoId = (filePath) => 'v' + crypto.createHash('md5').update(filePath).digest('hex').substring(0, 10);

// Format video title: remove extension, replace separators with spaces, clean up
const formatVideoTitle = (filename) => {
    let name = path.parse(filename).name;
    // Replace common separators with spaces
    name = name.replace(/[_\-\.]+/g, ' ');
    // Remove common junk tags like [1080p], (720p), x264, etc.
    name = name.replace(/[\[\(].*?[\]\)]/g, '').trim();
    // Capitalize first letter of each word
    return name.replace(/\b\w/g, c => c.toUpperCase()).trim() || filename;
};

// Format file size to human-readable
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Get correct MIME type based on file extension
const getMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime'
    };
    return mimeTypes[ext] || 'video/mp4';
};

// Helper function to format duration from seconds to MM:SS or HH:MM:SS
const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Async helper to get video duration using ffprobe
const getDuration = (filePath) => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                resolve('0:00'); // Default or fallback
            } else {
                const durationInSeconds = metadata.format.duration;
                resolve(formatDuration(durationInSeconds));
            }
        });
    });
};

// Returns both formatted string and raw seconds for progress calculation
const getDurationWithSeconds = (filePath) => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                resolve({ formatted: '0:00', seconds: 0 });
            } else {
                const secs = metadata.format.duration || 0;
                resolve({ formatted: formatDuration(secs), seconds: Math.round(secs) });
            }
        });
    });
};

const scanDirectories = async () => {
    let newCache = [];
    const dirsToScan = getDirsToScan();
    const seen = new Set(); // Avoid duplicate files across folders

    for (const dir of dirsToScan) {
        if (!fs.existsSync(dir)) continue;

        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (isVideo(file)) {
                    const fullPath = path.join(dir, file);
                    if (seen.has(fullPath)) continue;
                    seen.add(fullPath);

                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isFile()) {
                            const durationResult = await getDurationWithSeconds(fullPath);
                            newCache.push({
                                id: getVideoId(fullPath),
                                title: formatVideoTitle(file),
                                filename: file,
                                path: fullPath,
                                size: formatFileSize(stat.size),
                                uploadDate: new Date(stat.birthtime).toLocaleDateString(),
                                duration: durationResult.formatted,
                                durationSeconds: durationResult.seconds,
                                extension: path.extname(file).toLowerCase().replace('.', '')
                            });
                        }
                    } catch (statErr) {
                        // Skip files we can't access
                    }
                }
            }
        } catch (err) {
            console.error(`Error scanning ${dir}:`, err);
        }
    }

    videoCache = newCache;

    if (videoCache.length === 0) {
        console.log("No downloaded videos found. App will display an empty state.");
    }
};

// Initial scan
scanDirectories().then(() => {
    console.log(`Initial scan complete... Found ${videoCache.length} videos.`);
});

// API endpoint to get all videos (returns cached data — use /api/refresh to rescan)
app.get('/api/videos', (req, res) => {
    // Inject history and like data directly into the video objects
    const enhancedCache = videoCache.map(v => ({
        ...v,
        resumeTime: db.history[v.id] || 0,
        isLiked: db.likedVideos.includes(v.id)
    }));

    res.json(enhancedCache);
});

// Explicit endpoint to force a library rescan
app.post('/api/refresh', async (req, res) => {
    await scanDirectories();
    res.send({ success: true, count: videoCache.length });
});

// API: Get stats
app.get('/api/stats', (req, res) => {
    res.json({
        totalVideos: videoCache.length,
        customFolders: (db.customFolders || []).length,
        watchedVideos: Object.keys(db.history || {}).length,
        likedVideos: (db.likedVideos || []).length
    });
});

// API: Get custom folders list only (not the full DB)
app.get('/api/folders', (req, res) => {
    res.json({ folders: db.customFolders || [] });
});

app.post('/api/history', (req, res) => {
    const { videoId, timestamp } = req.body;
    if (!videoId || typeof timestamp !== 'number') {
        return res.status(400).send({ error: 'Invalid videoId or timestamp' });
    }
    db.history[videoId] = timestamp;
    saveDb();
    res.send({ success: true });
});

app.post('/api/folders', (req, res) => {
    const { folder } = req.body;
    if (!folder || typeof folder !== 'string') {
        return res.status(400).send({ error: 'Invalid folder path.' });
    }
    // Security: Normalize and validate the path
    const normalizedPath = path.resolve(folder);
    if (db.customFolders.includes(normalizedPath)) {
        return res.status(400).send({ error: 'Folder already added.' });
    }
    if (!fs.existsSync(normalizedPath)) {
        return res.status(400).send({ error: 'Folder does not exist on your PC.' });
    }
    db.customFolders.push(normalizedPath);
    saveDb();
    res.send({ success: true, path: normalizedPath });
});

// API: Remove a custom folder
app.delete('/api/folders', (req, res) => {
    const { folder } = req.body;
    if (!folder) return res.status(400).send({ error: 'No folder specified.' });
    db.customFolders = db.customFolders.filter(f => f !== folder);
    saveDb();
    res.send({ success: true });
});

// API: Toggle like on a video
app.post('/api/like/:id', (req, res) => {
    const videoId = req.params.id;
    const index = db.likedVideos.indexOf(videoId);
    if (index > -1) {
        db.likedVideos.splice(index, 1);
        saveDb();
        res.send({ liked: false });
    } else {
        db.likedVideos.push(videoId);
        saveDb();
        res.send({ liked: true });
    }
});

// API endpoint to stream a video
app.get('/api/stream/:id', (req, res) => {
    const video = videoCache.find(v => v.id === req.params.id);
    if (!video) {
        return res.status(404).send('Video not found');
    }

    const videoPath = video.path;
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
            res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
            return;
        }

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': getMimeType(videoPath),
        };

        res.writeHead(206, head);
        file.pipe(res);

        req.on('close', () => {
            if (!file.destroyed) file.destroy();
        });
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': getMimeType(videoPath),
        };
        res.writeHead(200, head);
        const file = fs.createReadStream(videoPath);
        file.pipe(res);

        req.on('close', () => {
            if (!file.destroyed) file.destroy();
        });
    }
});

// API endpoint to serve thumbnails
app.get('/api/thumbnail/:id', (req, res) => {
    const video = videoCache.find(v => v.id === req.params.id);
    if (!video) {
        return res.status(404).send('Video not found');
    }

    const thumbnailsDir = path.join(__dirname, 'thumbnails');
    if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir);

    const thumbName = `${video.id}.jpg`;
    const thumbPath = path.join(thumbnailsDir, thumbName);

    if (fs.existsSync(thumbPath)) {
        return res.sendFile(thumbPath);
    }

    // Generate thumbnail on the fly
    // Use fixed timestamp instead of percentage to avoid "Could not get input duration" errors
    ffmpeg(video.path)
        .on('end', () => {
            if (fs.existsSync(thumbPath)) {
                res.sendFile(thumbPath);
            } else {
                res.status(500).send('Thumbnail generated but not found');
            }
        })
        .on('error', (err) => {
            // Silently handle expected failures (audio-only files, corrupt videos)
            if (!res.headersSent) {
                res.status(404).send('Could not generate thumbnail');
            }
        })
        .screenshots({
            timestamps: ['00:00:01'],
            filename: `${video.id}.jpg`,
            folder: thumbnailsDir,
            size: '320x180'
        });
});

// API endpoint to delete a video
app.delete('/api/video/:id', (req, res) => {
    const videoIndex = videoCache.findIndex(v => v.id === req.params.id);
    if (videoIndex === -1) {
        return res.status(404).send('Video not found');
    }

    const video = videoCache[videoIndex];

    try {
        // Delete the actual video file
        if (fs.existsSync(video.path)) {
            fs.unlinkSync(video.path);
        }

        // Try to delete the thumbnail if exist
        const thumbPath = path.join(__dirname, 'thumbnails', `${video.id}.jpg`);
        if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
        }

        // Cleanup from database
        delete db.history[video.id];
        db.likedVideos = db.likedVideos.filter(id => id !== video.id);
        Object.keys(db.playlists).forEach(pl => {
            db.playlists[pl] = db.playlists[pl].filter(id => id !== video.id);
        });
        saveDb();

        // Remove from cache
        videoCache.splice(videoIndex, 1);

        console.log(`Deleted video: ${video.path}`);
        res.status(200).send({ message: 'Video deleted successfully' });
    } catch (err) {
        console.error('Error deleting video:', err);
        res.status(500).send({ error: 'Failed to delete video' });
    }
});

const server = app.listen(PORT, HOST, () => {
    console.log(`\n  ╔═══════════════════════════════════════════╗`);
    console.log(`  ║   LocalTube is running!                   ║`);
    console.log(`  ║   Open: http://localhost:${PORT}              ║`);
    console.log(`  ║   Locked to this PC only (127.0.0.1)      ║`);
    console.log(`  ║   Found ${String(videoCache.length).padEnd(4)} videos                      ║`);
    console.log(`  ╚═══════════════════════════════════════════╝\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down LocalTube...');
    server.close(() => process.exit(0));
});
