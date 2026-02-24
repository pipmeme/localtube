const videoGrid = document.getElementById('videoGrid');
const playerContainer = document.getElementById('playerContainer');
const categoriesBar = document.getElementById('categoriesBar');
const recommendedGrid = document.getElementById('recommendedGrid');

const videoPlayer = document.getElementById('videoPlayer');
const playerTitle = document.getElementById('playerTitle');
const playerViews = document.getElementById('playerViews');
const playerDate = document.getElementById('playerDate');
const playerPath = document.getElementById('playerPath');
const searchInput = document.getElementById('searchInput');
const sortDropdown = document.getElementById('sortDropdown');
const sidebar = document.querySelector('.sidebar');
const menuIcon = document.querySelector('.menu-icon');

let allVideos = [];
let currentVideos = []; // State for current filtered/sorted list
let currentPlayingVideoId = null;
let historyInterval = null;
let currentCategory = 'All';

// Fetch videos from the backend
async function fetchVideos() {
    try {
        const response = await fetch('/api/videos');
        allVideos = await response.json();
        currentVideos = [...allVideos];

        // Setup initial UI states
        document.getElementById('sortDropdown').value = 'default';
        currentCategory = 'All';

        applyFiltersAndSort();
    } catch (err) {
        console.error("Failed to fetch videos:", err);
        videoGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; margin-top: 40px; color: var(--secondary-text);">
                <h2>Welcome to LocalTube</h2>
                <p>Click the Settings Gear icon in the top right to add a custom folder.</p>
            </div>
        `;
    }
}

// Force backend to rescan
async function refreshLibrary() {
    try {
        const icon = document.querySelector('[title="Refresh Video Library"]');
        icon.style.transform = 'rotate(180deg)';
        icon.style.transition = 'transform 0.5s ease';

        await fetch('/api/refresh', { method: 'POST' });
        await fetchVideos();

        setTimeout(() => icon.style.transform = 'rotate(0deg)', 500);
    } catch (err) {
        console.error("Failed to refresh:", err);
        alert("Failed to refresh library.");
    }
}

// Format numbers like 1200 -> 1.2K
function formatCompactNumber(number) {
    const formatter = Intl.NumberFormat('en', { notation: 'compact' });
    return formatter.format(number);
}

// Generate an avatar color based on title
function getAvatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.substring(0, 2))}&background=random&color=fff&size=64`;
}

// Render the main video grid
function renderGrid(videos) {
    videoGrid.innerHTML = '';
    if (videos.length === 0) {
        videoGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; margin-top: 40px; color: var(--secondary-text);">
                <h2>No videos found</h2>
                <p>Ensure videos are located in your Downloads folder.</p>
            </div>
        `;
        return;
    }

    videos.forEach(video => {
        const d = document.createElement('div');
        d.className = 'video-card';
        d.onclick = () => playVideo(video);

        // Calculate progress bar width
        let progressHtml = '';
        if (video.resumeTime > 0) {
            // Very rough estimate of progress % if we don't have total seconds easily available
            // In a full app, duration would be parsed into seconds to get a real %.
            // For now, we'll just show a generic red bar if it's started
            progressHtml = `<div style="position:absolute; bottom:0; left:0; height:4px; background:red; width: 50%; z-index:3;"></div>`;
        }

        d.innerHTML = `
            <div class="thumbnail-container">
                <img src="/api/thumbnail/${video.id}" class="thumbnail-img" alt="Thumbnail" onerror="this.style.display='none'">
                <span class="material-icons thumbnail-icon">play_circle_filled</span>
                <div class="video-time">${video.duration}</div>
                ${progressHtml}
            </div>
            <div class="video-details">
                <img src="${getAvatarUrl(video.title)}" class="channel-icon" alt="channel">
                <div class="video-info">
                    <div class="video-title">${video.title}</div>
                    <div class="video-channel">Local System</div>
                    <div class="video-stats">${formatCompactNumber(video.views)} views &bull; ${video.uploadDate}</div>
                </div>
            </div>
        `;
        videoGrid.appendChild(d);
    });
}

// Render sidebar recommended videos list
function renderRecommended(currentVideoId) {
    recommendedGrid.innerHTML = '';
    const recs = allVideos.filter(v => v.id !== currentVideoId).slice(0, 10);

    recs.forEach(video => {
        const d = document.createElement('div');
        d.className = 'recommended-card';
        d.onclick = () => playVideo(video);

        d.innerHTML = `
            <div class="rec-thumb">
                <img src="/api/thumbnail/${video.id}" class="thumbnail-img" alt="Thumbnail" onerror="this.style.display='none'">
                <span class="material-icons">movie</span>
                <div class="video-time" style="position:absolute;bottom:4px;right:4px;">${video.duration}</div>
            </div>
            <div class="rec-details">
                <div class="rec-title">${video.title}</div>
                <div class="rec-channel">Local System</div>
                <div class="rec-stats">${formatCompactNumber(video.views)} views &bull; ${video.uploadDate}</div>
            </div>
        `;
        recommendedGrid.appendChild(d);
    });
}

// Switch to player view and stream video
function playVideo(video) {
    currentPlayingVideoId = video.id;

    // Hide grid and categories, show player
    videoGrid.style.display = 'none';
    categoriesBar.style.display = 'none';
    playerContainer.style.display = 'grid';

    // Update player info
    playerTitle.textContent = video.title;
    playerViews.textContent = `${Number(video.views).toLocaleString()} views`;
    playerDate.textContent = video.uploadDate;
    playerPath.textContent = video.path;

    // Set video source to stream endpoint
    document.title = `${video.title} - LocalTube`;
    videoPlayer.src = `/api/stream/${video.id}`;

    // Resume if we have history
    if (video.resumeTime > 0) {
        videoPlayer.currentTime = video.resumeTime;
    }

    videoPlayer.play().catch(e => console.error("Autoplay prevented or error:", e));

    // Start history tracking
    if (historyInterval) clearInterval(historyInterval);
    historyInterval = setInterval(() => {
        if (!videoPlayer.paused) {
            updateHistory(video.id, videoPlayer.currentTime);
            // Update local state so it doesn't get lost on navigating back
            const vIndex = allVideos.findIndex(v => v.id === video.id);
            if (vIndex > -1) allVideos[vIndex].resumeTime = videoPlayer.currentTime;
        }
    }, 5000); // Save every 5 seconds

    // Autoplay Next Video Logic
    videoPlayer.onended = () => {
        const autoplayEnabled = document.getElementById('autoplayToggle').checked;
        if (autoplayEnabled) {
            // Find next video in recommendations (which is just the filtered grid for now)
            const currentIndex = currentVideos.findIndex(v => v.id === video.id);
            if (currentIndex !== -1 && currentIndex + 1 < currentVideos.length) {
                const nextVideo = currentVideos[currentIndex + 1];
                console.log("Autoplaying next video:", nextVideo.title);
                playVideo(nextVideo);
            }
        }
    };

    // Update recommendations
    renderRecommended(video.id);

    // Scroll to top
    window.scrollTo(0, 0);
}

// Go back to home grid
function goHome() {
    if (historyInterval) clearInterval(historyInterval);
    if (currentPlayingVideoId && !videoPlayer.paused) {
        updateHistory(currentPlayingVideoId, videoPlayer.currentTime);
    }

    videoPlayer.pause();
    videoPlayer.src = '';
    document.title = 'LocalTube';
    currentPlayingVideoId = null;

    playerContainer.style.display = 'none';
    videoGrid.style.display = 'grid';
    categoriesBar.style.display = 'flex';
    renderGrid(allVideos);
}

// Show Watch History view
function showHistory() {
    goHome();

    // Filter videos that have a resume time and sort them by some metric (currently just showing them all)
    // Note: To sort by 'recently watched' we would need the backend to save timestamps of WHEN they were watched.
    // For now, we'll just show any video that has progress > 0.
    const historyVideos = allVideos.filter(v => v.resumeTime > 0);

    if (historyVideos.length === 0) {
        videoGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; margin-top: 40px; color: var(--secondary-text);">
                <h2>No Watch History</h2>
                <p>Videos you watch will appear here.</p>
            </div>
        `;
    } else {
        renderGrid(historyVideos);
    }

    // Update active sidebar link visually
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.getElementById('historyLink').classList.add('active');
}

// Search functionality
searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allVideos.filter(v => v.title.toLowerCase().includes(q));

    if (playerContainer.style.display === 'none') {
        applyFiltersAndSort();
    }
});

// Sorting and Filtering Logic
function filterCategory(category) {
    currentCategory = category;

    // Update active button styling
    document.querySelectorAll('.category').forEach(btn => {
        if (btn.innerText === category) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    applyFiltersAndSort();
}

function applySort() {
    applyFiltersAndSort();
}

function applyFiltersAndSort() {
    let result = [...allVideos];

    // 1. Text Search Filter
    const q = searchInput.value.toLowerCase();
    if (q) {
        result = result.filter(v => v.title.toLowerCase().includes(q));
    }

    // 2. Category Filter (Very basic keyword matching for demonstration)
    if (currentCategory !== 'All') {
        const catQ = currentCategory.toLowerCase();
        if (catQ === 'downloads') {
            result = result.filter(v => v.path && v.path.toLowerCase().includes('downloads'));
        } else {
            // For other mock categories, just look for the word in the filename
            result = result.filter(v => v.title && v.title.toLowerCase().includes(catQ));
        }
    }

    // 3. Sorting
    const sortVal = sortDropdown.value;
    if (sortVal === 'name') {
        result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortVal === 'dateNew') {
        // Since we moced dates as strings like 'MM/DD/YYYY', parse them back
        result.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    } else if (sortVal === 'dateOld') {
        result.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
    }

    currentVideos = result;
    renderGrid(currentVideos);
}

// Delete current video
async function deleteCurrentVideo() {
    if (!currentPlayingVideoId) return;

    if (!confirm("Are you sure you want to permanently delete this video from your computer? This cannot be undone.")) {
        return;
    }

    // Stop playback immediately to force the browser to close the connection, 
    // prompting the server to release the Windows file lock
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.load();

    // Give the server a small moment to actually release the file descriptor
    await new Promise(r => setTimeout(r, 500));

    try {
        const response = await fetch(`/api/video/${currentPlayingVideoId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove from local array
            allVideos = allVideos.filter(v => v.id !== currentPlayingVideoId);

            // Go back home and re-render
            goHome();
            renderGrid(allVideos);
            alert("Video successfully deleted from your PC.");
        } else {
            console.error("Failed to delete", await response.text());
            alert("Error deleting the video.");
        }
    } catch (err) {
        console.error("Error sending delete request", err);
        alert("Network error while trying to delete.");
    }
}

// Send history update to backend
function updateHistory(videoId, time) {
    fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, timestamp: time })
    }).catch(e => console.error("Failed to save history", e));
}

// Picture in Picture
async function togglePiP() {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled && videoPlayer) {
            await videoPlayer.requestPictureInPicture();
        }
    } catch (error) {
        console.error("PiP err:", error);
    }
}

// --- Settings & Folders ---
const settingsModal = document.getElementById('settingsModal');
const newFolderInput = document.getElementById('newFolderInput');
const foldersList = document.getElementById('foldersList');

async function openSettings() {
    settingsModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // prevent scrolling behind modal
    await fetchFolders();
}

function closeSettings() {
    settingsModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close settings if clicked outside content
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettings();
    }
});

// Sidebar Toggle Logic
menuIcon.addEventListener('click', () => {
    // If it's already shown via a media query, we might want to collapse it
    // For simplicity, let's just toggle a class that forces it open on mobile/small screens
    sidebar.classList.toggle('active');

    // Quick fix for desktop: toggle the width
    if (window.innerWidth > 900) {
        if (sidebar.style.display === 'none') {
            sidebar.style.display = 'block';
        } else {
            sidebar.style.display = 'none';
        }
    }
});

async function fetchFolders() {
    try {
        const res = await fetch('/api/db');
        const db = await res.json();

        foldersList.innerHTML = '';
        if (!db.customFolders || db.customFolders.length === 0) {
            foldersList.innerHTML = '<p style="color:var(--secondary-text)">No custom folders added.</p>';
        } else {
            db.customFolders.forEach(folder => {
                const el = document.createElement('div');
                el.style.padding = '8px';
                el.style.borderBottom = '1px solid var(--border-color)';
                el.innerText = folder;
                foldersList.appendChild(el);
            });
        }
    } catch (e) {
        console.error("Failed to fetch folders", e);
    }
}

async function addFolder() {
    const folder = newFolderInput.value.trim();
    if (!folder) return;

    try {
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder })
        });

        if (response.ok) {
            newFolderInput.value = '';
            await fetchFolders();

            // Re-fetch videos from backend since we added a new folder
            alert("Folder added! Rescanning videos...");
            await fetchVideos();
        } else {
            const data = await response.json();
            alert(data.error || "Failed to add folder.");
        }
    } catch (e) {
        console.error("Error adding folder", e);
        alert("Network error.");
    }
}

// Init
fetchVideos();
