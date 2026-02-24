# 🎬 LocalTube

A **YouTube-like local video player** for your PC. Watch, organize, and manage your downloaded videos with a beautiful, familiar interface — completely offline and private.

![LocalTube](https://img.shields.io/badge/version-1.0.0-blue) ![Node.js](https://img.shields.io/badge/node-%3E%3D18-green) ![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🎥 **Stream local videos** directly in your browser with a YouTube-style UI
- 🖼️ **Auto-generated thumbnails** from your video files
- 🔍 **Search & filter** your video library instantly
- 📂 **Custom folders** — scan any directory on your PC
- ⏯️ **Resume playback** — picks up where you left off
- ❤️ **Like videos** to save your favorites
- 🌙 **Dark & Light theme** with one-click toggle
- ⌨️ **Keyboard shortcuts** — Space, F, M, arrow keys, and more
- 🖼️ **Picture-in-Picture** mode
- 🔄 **Autoplay** next video
- ⚡ **Playback speed control** (0.25x to 2x)
- 🗑️ **Delete videos** directly from the interface
- 🔒 **Privacy-first** — locked to localhost, no internet required, no tracking

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/localtube.git
cd localtube

# Install dependencies
npm install

# Start the server
npm start
```

Open your browser and go to **http://localhost:3000**

That's it! LocalTube will automatically scan your Downloads folder for videos.

### Add More Video Folders

Click the ⚙️ **Settings** icon in the top-right to add custom folders from anywhere on your PC.

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `F` | Toggle Fullscreen |
| `M` | Toggle Mute |
| `←` | Rewind 10 seconds |
| `→` | Forward 10 seconds |
| `↑` / `↓` | Volume Up / Down |
| `Esc` | Go back to Home |
| `/` | Focus Search Bar |

## 📁 Supported Formats

| Format | Extension |
|--------|-----------|
| MP4 | `.mp4` |
| Matroska | `.mkv` |
| WebM | `.webm` |
| AVI | `.avi` |
| QuickTime | `.mov` |

## 🏗️ Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Video Processing:** FFmpeg (via fluent-ffmpeg)
- **Storage:** JSON file-based database (no external DB needed)

## 🔒 Security

LocalTube is designed for **personal, local use only**:

- ✅ Server binds to `127.0.0.1` (localhost only)
- ✅ No CORS — same-origin only
- ✅ No external API calls or tracking
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options)
- ✅ Input validation on all endpoints
- ✅ No data ever leaves your PC

## 📸 Screenshots

> Add your screenshots here after deploying!

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by YouTube's UI/UX
- [FFmpeg](https://ffmpeg.org/) for video processing
- [Express](https://expressjs.com/) for the web server
- [Material Icons](https://fonts.google.com/icons) for the iconography

---

**Made with ❤️ for offline video lovers**
