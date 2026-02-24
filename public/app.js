// ================================================================
// LocalTube — YouTube-Clone Frontend
// ================================================================

// --- DOM ---
const videoGrid = document.getElementById('videoGrid');
const playerContainer = document.getElementById('playerContainer');
const chipBar = document.getElementById('chip-bar');
const categoriesBar = document.getElementById('categoriesBar');
const recommendedGrid = document.getElementById('recommendedGrid');
const videoPlayer = document.getElementById('videoPlayer');
const playerTitle = document.getElementById('playerTitle');
const playerViews = document.getElementById('playerViews');
const playerDate = document.getElementById('playerDate');
const playerPath = document.getElementById('playerPath');
const searchInput = document.getElementById('searchInput');
const sortDropdown = document.getElementById('sortDropdown');
const guide = document.getElementById('guide');
const guideBtn = document.getElementById('guide-button');
const videoCountEl = document.getElementById('videoCount');

// --- State ---
let allVideos = [];
let currentVideos = [];
let currentPlayingVideoId = null;
let historyInterval = null;
let currentCategory = 'All';

// ================================================================
//  THEME
// ================================================================
function initTheme() {
    const saved = localStorage.getItem('localtube-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('localtube-theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
}

// ================================================================
//  PLAYER SETTINGS MEMORY
// ================================================================
function initPlayerSettings() {
    const vol = localStorage.getItem('localtube-volume');
    const spd = localStorage.getItem('localtube-speed');
    if (vol !== null) videoPlayer.volume = parseFloat(vol);
    if (spd !== null) videoPlayer.playbackRate = parseFloat(spd);
    videoPlayer.addEventListener('volumechange', () => localStorage.setItem('localtube-volume', videoPlayer.volume));
    videoPlayer.addEventListener('ratechange', () => localStorage.setItem('localtube-speed', videoPlayer.playbackRate));
}

// ================================================================
//  SIDEBAR TOGGLE
// ================================================================
guideBtn.addEventListener('click', () => {
    if (window.innerWidth <= 1100) {
        guide.classList.toggle('expanded-mobile');
    } else {
        guide.classList.toggle('collapsed');
        // adjust primary margin
        const primary = document.getElementById('primary');
        if (guide.classList.contains('collapsed')) {
            primary.style.marginLeft = '0';
        } else {
            primary.style.marginLeft = '240px';
        }
    }
});

// close mobile guide if clicking outside
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1100 && guide.classList.contains('expanded-mobile')) {
        if (!guide.contains(e.target) && e.target !== guideBtn && !guideBtn.contains(e.target)) {
            guide.classList.remove('expanded-mobile');
        }
    }
});

// ================================================================
//  FETCH VIDEOS
// ================================================================
async function fetchVideos() {
    try {
        videoGrid.innerHTML = `
            <div class="yt-empty">
                <span class="material-icons-outlined yt-spin">refresh</span>
                <h2>Loading your library...</h2>
            </div>`;
        const res = await fetch('/api/videos');
        allVideos = await res.json();
        currentVideos = [...allVideos];
        sortDropdown.value = 'default';
        currentCategory = 'All';
        if (videoCountEl) videoCountEl.textContent = allVideos.length + ' videos';
        applyFiltersAndSort();
    } catch (err) {
        console.error('Failed to fetch videos:', err);
        videoGrid.innerHTML = `
            <div class="yt-empty">
                <span class="material-icons-outlined">video_library</span>
                <h2>Welcome to LocalTube</h2>
                <p>No videos found yet. Click <b>Settings</b> to add a folder from your PC.</p>
            </div>`;
    }
}

async function refreshLibrary() {
    const icon = document.querySelector('[title="Refresh Library"] .material-icons-outlined');
    if (icon) icon.classList.add('yt-spin');
    showToast('Rescanning folders...');
    await fetch('/api/refresh', { method: 'POST' });
    await fetchVideos();
    if (icon) { icon.classList.remove('yt-spin'); }
    showToast('Library refreshed');
}

function showAllVideos() {
    goHome();
}

// ================================================================
//  UTILITY
// ================================================================
const avatarColors = ['#ff0000','#ff4081','#7c4dff','#448aff','#18ffff','#69f0ae','#ffab40','#ff6e40','#8d6e63'];

function makeAvatar(name) {
    const c = avatarColors[name.length % avatarColors.length];
    const initials = name.substring(0, 1).toUpperCase();
    return `<div class="yt-avatar" style="background:${c}">${initials}</div>`;
}

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' days ago';
    if (diff < 31536000) return Math.floor(diff / 2592000) + ' months ago';
    return Math.floor(diff / 31536000) + ' years ago';
}

// ================================================================
//  RENDER VIDEO GRID (YouTube exact card layout)
// ================================================================
function renderGrid(videos) {
    videoGrid.innerHTML = '';
    if (!videos.length) {
        videoGrid.innerHTML = `
            <div class="yt-empty">
                <span class="material-icons-outlined">search_off</span>
                <h2>No results found</h2>
                <p>Try different keywords or remove the search filter.</p>
            </div>`;
        return;
    }

    videos.forEach(v => {
        const card = document.createElement('div');
        card.className = 'yt-video-card';
        card.onclick = () => playVideo(v);

        // Calculate actual progress percentage
        let progressBar = '';
        if (v.resumeTime > 0 && v.durationSeconds > 0) {
            const pct = Math.min(100, Math.round((v.resumeTime / v.durationSeconds) * 100));
            progressBar = `<div class="yt-progress-bar" style="width:${pct}%"></div>`;
        }

        card.innerHTML = `
            <div class="yt-thumb-wrap">
                <div class="yt-thumb-placeholder"><span class="material-icons-outlined">movie</span></div>
                <img src="/api/thumbnail/${v.id}" alt="" loading="lazy" onerror="this.remove()">
                <div class="yt-thumb-overlay"></div>
                <span class="yt-thumb-time">${v.duration}</span>
                ${progressBar}
            </div>
            <div class="yt-card-bottom">
                <div class="yt-card-avatar">${makeAvatar(v.title)}</div>
                <div class="yt-card-meta">
                    <div class="yt-card-title">${v.title}</div>
                    <div class="yt-card-channel">Local System</div>
                    <div class="yt-card-info">${v.size} &bull; ${v.uploadDate}</div>
                </div>
            </div>`;
        videoGrid.appendChild(card);
    });
}

// ================================================================
//  RENDER RECOMMENDATIONS
// ================================================================
function renderRecommended(currentId) {
    if (!recommendedGrid) return;
    recommendedGrid.innerHTML = '';
    const recs = allVideos.filter(v => v.id !== currentId).slice(0, 20);

    recs.forEach(v => {
        const card = document.createElement('div');
        card.className = 'yt-rec-card';
        card.onclick = () => playVideo(v);
        card.innerHTML = `
            <div class="yt-rec-thumb">
                <img src="/api/thumbnail/${v.id}" alt="" loading="lazy" onerror="this.remove()">
                <span class="yt-thumb-time">${v.duration}</span>
            </div>
            <div class="yt-rec-meta">
                <div class="yt-rec-title">${v.title}</div>
                <div class="yt-rec-channel">Local System</div>
                <div class="yt-rec-info">${v.size} &bull; ${v.uploadDate}</div>
            </div>`;
        recommendedGrid.appendChild(card);
    });
}

// ================================================================
//  PLAY VIDEO
// ================================================================
function playVideo(video) {
    currentPlayingVideoId = video.id;

    // Hide grid, show player
    videoGrid.style.display = 'none';
    chipBar.style.display = 'none';
    playerContainer.style.display = 'flex';

    playerTitle.textContent = video.title;
    playerViews.textContent = video.size;
    playerDate.textContent = video.uploadDate;
    playerPath.textContent = video.path;
    updateLikeButton(video.isLiked);

    document.title = video.title + ' - LocalTube';
    videoPlayer.src = `/api/stream/${video.id}`;

    // Resume from saved position after metadata loads
    const resumeHandler = () => {
        if (video.resumeTime > 0) videoPlayer.currentTime = video.resumeTime;
        const spd = localStorage.getItem('localtube-speed');
        if (spd) videoPlayer.playbackRate = parseFloat(spd);
        videoPlayer.removeEventListener('loadedmetadata', resumeHandler);
    };
    videoPlayer.addEventListener('loadedmetadata', resumeHandler);

    videoPlayer.play().catch(() => {});

    // History tracking
    if (historyInterval) clearInterval(historyInterval);
    historyInterval = setInterval(() => {
        if (!videoPlayer.paused) {
            updateHistory(video.id, videoPlayer.currentTime);
            const idx = allVideos.findIndex(x => x.id === video.id);
            if (idx > -1) allVideos[idx].resumeTime = videoPlayer.currentTime;
        }
    }, 5000);

    // Autoplay
    videoPlayer.onended = () => {
        const toggle = document.getElementById('autoplayToggle');
        if (toggle && toggle.checked) {
            const i = currentVideos.findIndex(x => x.id === video.id);
            if (i !== -1 && i + 1 < currentVideos.length) playVideo(currentVideos[i + 1]);
        }
    };

    renderRecommended(video.id);
    window.scrollTo(0, 0);
}

// ================================================================
//  LIKE
// ================================================================
function updateLikeButton(isLiked) {
    const btn = document.getElementById('likeBtn');
    if (!btn) return;
    if (isLiked) {
        btn.classList.add('liked');
        btn.querySelector('.material-icons-outlined').textContent = 'thumb_up';
        const lbl = btn.querySelector('.action-label');
        if (lbl) lbl.textContent = 'Liked';
    } else {
        btn.classList.remove('liked');
        btn.querySelector('.material-icons-outlined').textContent = 'thumb_up';
        const lbl = btn.querySelector('.action-label');
        if (lbl) lbl.textContent = 'Like';
    }
}

async function toggleLike() {
    if (!currentPlayingVideoId) return;
    try {
        const res = await fetch(`/api/like/${currentPlayingVideoId}`, { method: 'POST' });
        const data = await res.json();
        updateLikeButton(data.liked);
        const v = allVideos.find(x => x.id === currentPlayingVideoId);
        if (v) v.isLiked = data.liked;
    } catch (e) { console.error(e); }
}

// ================================================================
//  NAVIGATION
// ================================================================
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
    chipBar.style.display = '';

    setActiveGuide('homeLink');
    applyFiltersAndSort();
}

function setActiveGuide(id) {
    document.querySelectorAll('.guide-entry').forEach(e => e.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function showHistory() {
    goHome();
    const vids = allVideos.filter(v => v.resumeTime > 0);
    if (!vids.length) {
        videoGrid.innerHTML = `<div class="yt-empty"><span class="material-icons-outlined">history</span><h2>No watch history yet</h2><p>Videos you watch will show up here.</p></div>`;
    } else {
        renderGrid(vids);
    }
    setActiveGuide('historyLink');
}

function showLikedVideos() {
    goHome();
    const vids = allVideos.filter(v => v.isLiked);
    if (!vids.length) {
        videoGrid.innerHTML = `<div class="yt-empty"><span class="material-icons-outlined">favorite_border</span><h2>No liked videos</h2><p>Videos you like will show up here.</p></div>`;
    } else {
        renderGrid(vids);
    }
    setActiveGuide('likedLink');
}

// ================================================================
//  SEARCH, FILTER, SORT
// ================================================================
searchInput.addEventListener('input', () => {
    if (playerContainer.style.display === 'none') applyFiltersAndSort();
});
searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyFiltersAndSort();
});

function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.chip').forEach(b => {
        if (b.tagName === 'BUTTON') b.classList.toggle('active', b.textContent === cat);
    });
    // If we were on player, go home first
    if (playerContainer.style.display !== 'none') goHome();
    applyFiltersAndSort();
}

function applySort() { applyFiltersAndSort(); }

function applyFiltersAndSort() {
    let result = [...allVideos];

    // Search
    const q = searchInput.value.toLowerCase().trim();
    if (q) result = result.filter(v => v.title.toLowerCase().includes(q) || v.filename.toLowerCase().includes(q));

    // Category
    if (currentCategory !== 'All') {
        const c = currentCategory.toLowerCase();
        if (c === 'downloads') {
            result = result.filter(v => v.path && v.path.toLowerCase().includes('downloads'));
        } else if (c === 'large files') {
            result = result.filter(v => (v.size || '').includes('GB') || ((v.size || '').includes('MB') && parseFloat(v.size) > 500));
        } else if (c === 'recently watched') {
            result = result.filter(v => v.resumeTime > 0);
        } else {
            result = result.filter(v => v.title.toLowerCase().includes(c) || v.filename.toLowerCase().includes(c));
        }
    }

    // Sort
    const s = sortDropdown.value;
    if (s === 'name') result.sort((a, b) => a.title.localeCompare(b.title));
    else if (s === 'nameDesc') result.sort((a, b) => b.title.localeCompare(a.title));
    else if (s === 'dateNew') result.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    else if (s === 'dateOld') result.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));

    currentVideos = result;
    renderGrid(currentVideos);
}

// ================================================================
//  DELETE
// ================================================================
async function deleteCurrentVideo() {
    if (!currentPlayingVideoId) return;
    if (!confirm('Permanently delete this video from your PC? This can\'t be undone.')) return;
    videoPlayer.pause(); videoPlayer.src = ''; videoPlayer.load();
    await new Promise(r => setTimeout(r, 500));
    try {
        const res = await fetch(`/api/video/${currentPlayingVideoId}`, { method: 'DELETE' });
        if (res.ok) {
            allVideos = allVideos.filter(v => v.id !== currentPlayingVideoId);
            goHome();
            showToast('Video deleted');
        } else showToast('Error deleting video', true);
    } catch (e) { showToast('Network error', true); }
}

// ================================================================
//  HISTORY / PiP / SPEED
// ================================================================
function updateHistory(videoId, time) {
    fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, timestamp: time }) }).catch(() => {});
}

async function togglePiP() {
    try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else if (document.pictureInPictureEnabled) await videoPlayer.requestPictureInPicture();
    } catch (e) {}
}

function changeSpeed() {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const cur = videoPlayer.playbackRate;
    // Find closest speed in the list, then go to next
    let closest = 0;
    for (let i = 0; i < speeds.length; i++) {
        if (Math.abs(speeds[i] - cur) < Math.abs(speeds[closest] - cur)) closest = i;
    }
    const next = speeds[(closest + 1) % speeds.length];
    videoPlayer.playbackRate = next;
    showToast(`Speed: ${next}x`);
}

// ================================================================
//  TOAST (YouTube-style snackbar)
// ================================================================
function showToast(msg, isError = false) {
    const old = document.querySelector('.yt-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'yt-toast' + (isError ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ================================================================
//  SETTINGS MODAL
// ================================================================
const settingsModal = document.getElementById('settingsModal');
const newFolderInput = document.getElementById('newFolderInput');
const foldersList = document.getElementById('foldersList');

function openSettings() {
    settingsModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    fetchFolders();
}
function closeSettings() {
    settingsModal.style.display = 'none';
    document.body.style.overflow = '';
}
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

async function fetchFolders() {
    try {
        const res = await fetch('/api/folders');
        const data = await res.json();
        foldersList.innerHTML = '';
        if (!data.folders || !data.folders.length) {
            foldersList.innerHTML = '<div style="padding:12px;color:var(--yt-text-secondary);font-size:13px;">No custom folders added yet.</div>';
        } else {
            data.folders.forEach(f => {
                const el = document.createElement('div');
                el.className = 'folder-item';
                el.innerHTML = `<span class="material-icons-outlined" style="font-size:18px;">folder</span><span style="flex:1;word-break:break-all;">${f}</span><span class="material-icons folder-remove-btn" onclick="removeFolder('${f.replace(/\\/g, '\\\\')}')">close</span>`;
                foldersList.appendChild(el);
            });
        }
    } catch (e) {}
}

async function addFolder() {
    const f = newFolderInput.value.trim();
    if (!f) return;
    try {
        const res = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: f }) });
        if (res.ok) { newFolderInput.value = ''; await fetchFolders(); showToast('Folder added – rescanning...'); await fetchVideos(); }
        else { const d = await res.json(); showToast(d.error || 'Failed', true); }
    } catch (e) { showToast('Network error', true); }
}

async function removeFolder(f) {
    try {
        const res = await fetch('/api/folders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: f }) });
        if (res.ok) { await fetchFolders(); showToast('Folder removed'); await fetchVideos(); }
    } catch (e) {}
}

// ================================================================
//  KEYBOARD SHORTCUTS
// ================================================================
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (playerContainer.style.display !== 'none') {
        switch (e.key) {
            case ' ': case 'k': e.preventDefault(); videoPlayer.paused ? videoPlayer.play() : videoPlayer.pause(); break;
            case 'f': videoPlayer.requestFullscreen?.(); break;
            case 'm': videoPlayer.muted = !videoPlayer.muted; break;
            case 'ArrowLeft': videoPlayer.currentTime -= 10; break;
            case 'ArrowRight': videoPlayer.currentTime += 10; break;
            case 'ArrowUp': e.preventDefault(); videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.1); break;
            case 'ArrowDown': e.preventDefault(); videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.1); break;
            case 'Escape': goHome(); break;
        }
    }

    if (e.key === '/' && playerContainer.style.display === 'none') { e.preventDefault(); searchInput.focus(); }
    if (e.key === '?' && !e.ctrlKey) { document.getElementById('shortcutsModal').style.display = 'flex'; }
});

// ================================================================
//  INIT
// ================================================================
initTheme();
initPlayerSettings();
fetchVideos();
