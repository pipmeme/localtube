const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cors = require('cors');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

const scanDirectories = async () => {
    let idCounter = 1;
    let newCache = [];
    const dirsToScan = getDirsToScan();

    for (const dir of dirsToScan) {
        if (!fs.existsSync(dir)) continue;

        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (isVideo(file)) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    if (stat.isFile()) {
                        const duration = await getDuration(fullPath);
                        newCache.push({
                            id: `v${idCounter++}`,
                            title: file,
                            filename: file,
                            path: fullPath,
                            views: Math.floor(Math.random() * 1000000) + 1000,
                            uploadDate: new Date(stat.birthtime).toLocaleDateString(),
                            duration: duration
                        });
                    }
                }
            }
        } catch (err) {
            console.error(`Error scanning ${dir}:`, err);
        }
    }

    videoCache = newCache;

    // If no videos found, add some mock entries so the UI still renders something
    if (videoCache.length === 0) {
        console.log("No downloaded videos found. App will display an empty state or errors.");
    }
};

// Initial scan
scanDirectories().then(() => {
    console.log(`Initial scan complete... Found ${videoCache.length} videos.`);
});

// API endpoint to get all videos (now attaching history/likes)
app.get('/api/videos', async (req, res) => {
    // Rescan to catch any newly downloaded videos asynchronously
    await scanDirectories();

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

// Settings / DB API endpoints
app.get('/api/db', (req, res) => {
    res.json(db);
});

app.post('/api/history', (req, res) => {
    const { videoId, timestamp } = req.body;
    db.history[videoId] = timestamp;
    saveDb();
    res.send({ success: true });
});

app.post('/api/folders', (req, res) => {
    const { folder } = req.body;
    if (folder && !db.customFolders.includes(folder)) {
        if (fs.existsSync(folder)) {
            db.customFolders.push(folder);
            saveDb();
            res.send({ success: true });
        } else {
            res.status(400).send({ error: 'Folder does not exist.' });
        }
    } else {
        res.status(400).send({ error: 'Invalid or existing folder.' });
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
            'Content-Type': 'video/mp4', // Simplification, could be dynamic based on ext
        };

        res.writeHead(206, head);
        file.pipe(res);

        req.on('close', () => {
            if (!file.destroyed) file.destroy();
        });
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
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
    ffmpeg(video.path)
        .on('end', () => {
            if (fs.existsSync(thumbPath)) {
                res.sendFile(thumbPath);
            } else {
                res.status(500).send('Thumbnail generated but not found');
            }
        })
        .on('error', (err) => {
            console.error(`Error generating thumbnail for ${video.title}:`);
            console.error(err);
            if (!res.headersSent) {
                // Return a clear 404 if ffmpeg totally fails to read the video stream (e.g. corrupt or unsupported)
                res.status(404).send('Failed to generate thumbnail for this video type.');
            }
        })
        .screenshots({
            timestamps: ['10%'],
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

app.listen(PORT, () => {
    console.log(`LocalTube Server running at http://localhost:${PORT}`);
    console.log(`Scanning for downloaded videos... Found ${videoCache.length} videos.`);
});
