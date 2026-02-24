<div align="center">
  <h1>🍿 LocalTube</h1>
  <p><b>The Zero-Setup, Offline YouTube Clone for your Desktop.</b></p>
</div>

<br/>

Let's be honest, you hate massive software installations, SQL databases, and bloated media servers just to watch a few downloaded coding tutorials or movies.

**LocalTube** is an ultra-lightweight Node.js app. You boot it up, it points at your `Downloads` folder, and it instantly builds a flawless, premium "Dark Mode YouTube" aesthetic for your personal files.

## ✨ Features
- **Zero Setup needed:** No databases or user accounts to configure. It creates a tiny hidden file to save your watch history locally and that's it!
- **1:1 Premium UI Aesthetic:** Built completely in Vanilla HTML/CSS with dark mode tokens inspired by YouTube's cinematic mode.
- **Smart Features Out of the Box:**
  - Watch History (resumes your video exactly where you left off).
  - Autoplay Next & Picture-in-Picture.
  - Live thumbnail generation at the 10% mark.
  - Custom Folder Management API.

---

## 🔒 Privacy Guarantee
**Your videos are NEVER uploaded to GitHub or the internet.** 
LocalTube is strictly a *local* server. It only reads files from existing folders on your PC. Furthermore, this repository includes a strict `.gitignore` file that ensures your personal watch history and generated thumbnail images are **never** accidentally uploaded anywhere. You can safely share this code without exposing your watching habits or personal files.

---

## 👶 How to Install & Run (Extremely Easy Guide)

Even if you are 7 years old and have never coded before, you can run this in 30 seconds! 

**Prerequisite:** You just need to download and install [Node.js](https://nodejs.org/en) on your computer first.

### Step 1: Download the Code
Copy and paste this exact command into your terminal / command prompt:
```bash
git clone https://github.com/pipmeme/localtube.git
```

### Step 2: Open the Folder
```bash
cd localtube
```

### Step 3: Install the Background Engine
```bash
npm install
```

### Step 4: Start LocalTube!
```bash
node server.js
```

**That's it!** Now just open your favorite web browser (like Chrome or Safari) and go to: **[http://localhost:3000](http://localhost:3000)**

---

## 📁 How to Use & Add Videos
1. **Bulk Adds & Scans**: Upon boot, LocalTube scans your main `Downloads` folder automatically. If you download a new video, press the **"Refresh"** icon in the top right to instantly rescan!
2. **Adding Custom Folders**: Click the **"Settings"** Gear Icon in the top right. You can copy and paste the path to any folder on your computer (for example: `C:\Movies`) and LocalTube will instantly begin serving videos from that location.
3. **Deleting**: Yes, the UI actually has a "Delete" button. Pressing it will permanently erase the source file from your hard drive, allowing you to use LocalTube to clean up your computer!

## 💻 Tech Stack
- **Frontend**: Vanilla Javascript, HTML5, Vanilla CSS Design System. No bloated React bundles!
- **Backend**: Node.js, Express, `fluent-ffmpeg` for thumbnail generation.
