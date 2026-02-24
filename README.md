# LocalTube

A 100% offline, privacy-first, zero-setup YouTube clone to serve your local media files with style. Let's be honest, you hate massive software installations, SQL databases, and bloated media servers just to watch a few downloaded coding tutorials or videos.

LocalTube is an ultra-lightweight Node.js script. You boot it up, it points at your `Downloads` folder, and it instantly builds a flawless, premium "Dark Mode YouTube" aesthetic for your personal files.

## Features
- **Zero Setup needed:** No databases or user accounts to configure. It creates a tiny JSON file to save your watch history locally and that's it!
- **1:1 Premium UI Aesthetic:** Built completely in Vanilla HTML/CSS with dark mode tokens inspired by YouTube's cinematic mode.
- **Smart Features Out of the Box:**
  - Watch History (resumes your video exactly where you left off).
  - Autoplay Next & Picture-in-Picture.
  - Live thumbnail generation at the 10% mark (using FFmpeg).
  - Custom Folder Management API.

## Installation

You need `Node.js` installed on your machine.

```bash
# Clone the repository
git clone https://github.com/yourusername/localtube.git

# Enter the directory
cd localtube

# Install dependencies (Express, CORS, FFmpeg hooks)
npm install

# Start the server
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

## Usage & Configuration
1. **Bulk Adds & Scans**: Upon boot, LocalTube scans your main `Downloads` folder automatically. If you download a new video, press the "Refresh" icon in the top right to instantly rescan!
2. **Adding Custom Folders**: Click the "Settings" Gear Icon in the top right. You can paste the absolute path to any folder on your computer (e.g. `C:\Users\Name\Desktop\Movies`) and the server will instantly begin serving videos from that location.
3. **Deleting**: Yes, the UI actually has a "Delete" button. Pressing it will permanently, explicitly erase the source file from your hard drive, allowing you to use LocalTube for fast organization and clean up of large media files.

## Technology Stack
- **Frontend**: Vanilla Javascript, HTML5, Vanilla CSS Design System. No massive React bundles here!
- **Backend**: Node.js, Express, `fluent-ffmpeg` for thumbnail generation.
