# Agent Guide for source-esbuild

## Build Commands
- `npm start` or `npm run serve` - Start dev server with live reload (BrowserSync on port 3000)
- `npm run build` - Production build (minified)
- `npm run dev` - Development build with watch mode
- `npm run core` - Build only core JS/CSS bundles
- `npm run pages` - Build only page-specific bundles
- `npm run createFile` - CLI tool to create new files

## Architecture
- **esbuild.js** - Main build orchestrator with FTP deployment, file watching, and BrowserSync
- **config.json** - Build configuration for vendor JS/CSS paths and minification settings
- **src/components/** - SASS components (organized as _core/, _global/, _tailwind/)
- **src/js/main.js** - Main JS entry point (bundled to dist/js/main.min.js)
- **src/pages/** - Pug templates compiled to HTML
- **dist/** - Build output directory (js/, css/, img/, fonts/)

## Code Style
- Use ES5+ JavaScript, maintain compatibility with jQuery and legacy plugins
- SASS files use indented `.sass` syntax, organized by component hierarchy
- CSS follows concentric-css ordering via PostCSS
- Build errors tracked via `lastSuccessfulBuild` state to prevent deploying broken builds
- FTP deployment via `config-ftp.json` with auto-deploy toggle (press 'd' in serve mode)
- Use `logBeautiful()` helper for consistent logging, avoid verbose output unless `--verbose` flag
