# 🚀 Frontend Build System with FTP Deployment

A modern frontend build tool powered by esbuild, combining SASS, TailwindCSS, and Pug templating with integrated FTP deployment and live reloading.

## 🛠️ Tech Stack

- **esbuild** - Fast JavaScript/CSS bundler
- **SASS** - CSS preprocessor (indented syntax)
- **TailwindCSS** - Utility-first CSS framework
- **Pug** - HTML template engine
- **BrowserSync** - Live reload development server
- **PostCSS** - CSS processing (autoprefixer, cssnano, concentric-css ordering)
- **basic-ftp** - FTP deployment with interactive keyboard shortcuts

## 📋 Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: 10.0.0 or higher
- **Optional**: Python v3.12 (for some dependencies)

## 📦 Installation

```bash
npm install
```

## 🎯 Commands

### Development

```bash
npm start              # Start dev server with live reload on port 3000
npm run dev            # Development build with watch mode (no server)
npm run serve          # Same as npm start
```

### Build

```bash
npm run build          # Production build (minified)
npm run core           # Build only core JS/CSS bundles (vendor files)
npm run pages          # Build only page-specific bundles
```

### Utilities

```bash
npm run createFile     # CLI tool to create new component files
```

## ⚙️ Configuration

### config.json

Main build configuration for vendor dependencies and minification.

```json
{
  "minify": true,                           // Enable/disable minification
  "font": ["src/assets/fonts/**"],          // Font directories
  "js": [                                   // Vendor JS files (concatenated to core.min.js)
    "node_modules/jquery/dist/jquery.min.js",
    "node_modules/@fancyapps/ui/dist/fancybox.umd.js"
  ],
  "css": [                                  // Vendor CSS files (bundled to core.min.css)
    "node_modules/swiper/swiper-bundle.min.css",
    "node_modules/aos/dist/aos.css"
  ]
}
```

**Key settings:**
- `minify`: Set to `false` for faster dev builds, `true` for production
- `js`: Vendor JavaScript files (bundled to `dist/js/core.min.js`)
- `css`: Vendor CSS files (bundled to `dist/css/core.min.css`)
- `font`: Font source directories (copied to `dist/fonts/`)

### config-ftp.json

FTP deployment configuration with interactive keyboard shortcuts.

```json
{
  "connection": {
    "host": "your-ftp-host.com",
    "user": "username",
    "password": "password",
    "secure": false
  },
  "deployment": {
    "basePath": "/public_html/path",        // Remote base directory
    "localFolder": "dist",                  // Local build directory
    "mappings": {
      "styles": {
        "local": "css",                     // Local: dist/css
        "remote": "styles",                 // Remote: basePath/styles
        "description": "Deploy CSS files"
      }
      // ... more mappings
    }
  },
  "shortcuts": {
    "u": { "action": "deployScripts" },     // Press 'U' to deploy JS
    "i": { "action": "deployStyles" },      // Press 'I' to deploy CSS
    "d": { "action": "toggleAutoDeploy" }   // Press 'D' to toggle auto-deploy
  }
}
```

**Connection settings:**
- `host`: FTP server address
- `user`: FTP username
- `password`: FTP password
- `secure`: Use FTPS (default: false)

**Deployment mappings:**
- `local`: Folder inside `dist/` directory
- `remote`: Target folder on FTP server (relative to `basePath`)
- `exclude`: Files to skip (e.g., `["*.map", "*.log"]`)

**Keyboard shortcuts:**
When server is running, press these keys for instant deployment:
- **U** - Deploy Scripts
- **I** - Deploy Styles
- **M** - Deploy Images
- **F** - Deploy Fonts
- **A** - Deploy All Files
- **D** - Toggle Auto-Deploy Mode

## 📁 Project Structure

```
source-esbuild/
├── src/
│   ├── components/          # SASS components (_core/, _global/, _tailwind/)
│   ├── js/
│   │   └── main.js         # Main JS entry point
│   ├── pages/              # Pug templates
│   └── assets/             # Images, fonts, favicon
├── dist/                   # Build output (git ignored)
│   ├── js/                 # Compiled JavaScript
│   ├── css/                # Compiled CSS
│   ├── img/                # Copied images
│   └── fonts/              # Copied fonts
├── config.json             # Build configuration
├── config-ftp.json         # FTP deployment config
├── pages.json              # Page-specific bundle config
└── esbuild.js              # Main build script
```

## 🔄 Workflow

### Development Mode

1. Run `npm start` to start dev server
2. Edit files in `src/`
3. Browser auto-reloads on changes
4. Press keyboard shortcuts to deploy to FTP

### Production Build

1. Set `"minify": true` in `config.json`
2. Run `npm run build`
3. Files are minified in `dist/`
4. Deploy using `npm start` + keyboard shortcuts

## 🚨 Troubleshooting

- **Build fails**: Check that all paths in `config.json` exist
- **FTP not working**: Verify credentials in `config-ftp.json`
- **Port 3000 in use**: BrowserSync will use next available port
- **Keyboard shortcuts not working**: Make sure `config-ftp.json` exists

## 📝 License

ISC
