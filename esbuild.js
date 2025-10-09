const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const tailwindcss = require('tailwindcss');
const cssSort = require('css-declaration-sorter');
const pug = require('pug');
const chokidar = require('chokidar');
const browserSync = require('browser-sync');
const boxen = require('boxen');
const ftp = require('basic-ftp');
const colors = require('ansi-colors');
const logSymbols = require('log-symbols');
const chalk = require('chalk');
const Table = require('cli-table3');
const ora = require('ora');

// Helper function to ensure stdin stays in raw mode
function ensureRawStdin() {
	const stdin = process.stdin;
	if (!stdin) return;
	if (stdin.isTTY) {
		if (!stdin.isRaw && stdin.setRawMode) stdin.setRawMode(true);
	}
	if (stdin.isPaused && stdin.isPaused()) stdin.resume();
}

// Helper function to create spinners with quiet mode support
function createSpinner(text) {
	const quietMode = process.argv.includes('--quiet') || process.env.NODE_ENV === 'production';

	const spinner = ora({
		text: text,
		isEnabled: !quietMode,
		isSilent: quietMode, // Use isSilent to completely suppress output in quiet mode
		discardStdin: false, // CRITICAL: prevent ora from pausing stdin
		stream: process.stdout // explicit stream
	});

	// Override succeed and fail methods to handle quiet mode properly
	const originalSucceed = spinner.succeed.bind(spinner);
	const originalFail = spinner.fail.bind(spinner);
	const originalStop = spinner.stop.bind(spinner);
	const originalStopAndPersist = spinner.stopAndPersist ? spinner.stopAndPersist.bind(spinner) : null;

	spinner.succeed = function(message) {
		if (quietMode) {
			// In quiet mode, don't show success messages (matching original behavior)
			this.stop();
			return this;
		}
		const res = originalSucceed(message);
		ensureRawStdin(); // Restore stdin state after spinner stops
		return res;
	};

	spinner.fail = function(message) {
		// Always show fail messages (matching original behavior)
		const res = originalFail(message);
		ensureRawStdin(); // Restore stdin state after spinner stops
		return res;
	};

	spinner.stop = function(...args) {
		const res = originalStop(...args);
		ensureRawStdin(); // Restore stdin state after spinner stops
		return res;
	};

	if (originalStopAndPersist) {
		spinner.stopAndPersist = function(...args) {
			const res = originalStopAndPersist(...args);
			ensureRawStdin(); // Restore stdin state after spinner stops
			return res;
		};
	}

	return spinner;
}

// Read configuration files
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const pagesConfig = JSON.parse(fs.readFileSync('pages.json', 'utf8'));
let ftpConfig = null;

// Load FTP config if it exists
try {
	ftpConfig = JSON.parse(fs.readFileSync('config-ftp.json', 'utf8'));
} catch (error) {
	console.log(colors.yellow('⚠️  FTP config not found. FTP deployment disabled.'));
}

// Build options - Default to dev mode with watch and sourcemaps
const isDev = true;

// Minification option from config (can be overridden by command line)
const shouldMinify = config.minify !== undefined ? config.minify : !isDev;

// Performance tracking with optimization info
const buildStats = {
	tasks: {},
	start: null,
	end: null,
	buildCount: 0,
	lastSuccessfulBuild: null,
	optimizations: {
		minification: shouldMinify,
		sourceMaps: isDev,
		mode: isDev ? 'development' : 'production',
		bundling: true,
		treeshaking: shouldMinify
	}
};

function trackTask (name, fn) {
	return async (...args) => {
		const start = Date.now();
		try {
			const result = await fn(...args);
			buildStats.tasks[name] = Date.now() - start;
			return result;
		} catch (error) {
			buildStats.tasks[name] = Date.now() - start;
			throw error;
		}
	};
}

// Beautiful logging system with quiet mode support
function logBeautiful (type, title, message = '', details = null) {
	const quietMode = process.argv.includes('--quiet');
	const isVerbose = process.argv.includes('--verbose');

	// In quiet mode, only show errors and critical info
	if (quietMode && !['error', 'warning'].includes(type)) {
		return;
	}

	const timestamp = isVerbose ? colors.gray(`[${new Date().toLocaleTimeString()}]`) : '';
	let icon, titleColor, messageColor;

	switch (type) {
		case 'success':
			icon = colors.green('✓');
			titleColor = colors.green;
			messageColor = colors.white;
			break;
		case 'error':
			icon = colors.red('✗');
			titleColor = colors.red;
			messageColor = colors.white;
			break;
		case 'info':
			icon = colors.blue('ℹ');
			titleColor = colors.blue;
			messageColor = colors.white;
			break;
		case 'warning':
			icon = colors.yellow('⚠');
			titleColor = colors.yellow;
			messageColor = colors.white;
			break;
		case 'start':
			icon = colors.cyan('▶');
			titleColor = colors.cyan;
			messageColor = colors.white;
			break;
		default:
			icon = colors.white('•');
			titleColor = colors.white;
			messageColor = colors.gray;
	}

	const timestampStr = timestamp ? `${timestamp} ` : '';
	console.log(`${timestampStr}${icon} ${titleColor(title)}${message ? `: ${messageColor(message)}` : ''}`);

	if (details && isVerbose) {
		console.log(`${' '.repeat(12)}${colors.gray(details)}`);
	}
}


// Show optimized build stats with enhanced boxen layout
function showBuildStats () {
	if (Object.keys(buildStats.tasks).length === 0) return;

	const totalTime = buildStats.end - buildStats.start;
	const buildDate = new Date();
	const buildTimeStr = buildDate.toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	// Compact performance summary
	let perfSummary = '';
	let envSummary = '';

	// Build performance data in compact format
	const sortedTasks = Object.entries(buildStats.tasks).sort((a, b) => b[1] - a[1]);
	const topTasks = sortedTasks.slice(0, 4); // Show top 4 tasks only

	perfSummary += colors.bold(colors.white('⚡ Performance\n'));
	topTasks.forEach(([task, time]) => {
		const percentage = ((time / totalTime) * 100).toFixed(1);
		const barLength = Math.max(1, Math.floor(percentage * 0.15));
		const bar = colors.cyan('█'.repeat(barLength)) + colors.gray('░'.repeat(Math.max(0, 12 - barLength)));
		const taskName = task.substring(0, 14).padEnd(14);
		const timeText = colors.yellow(time + 'ms');
		const percentText = colors.gray('(' + percentage + '%)');

		perfSummary += `  ${colors.white(taskName)} ${bar} ${timeText} ${percentText}\n`;
	});

	// Create minimal build completion box
	const buildMessage = boxen(
		`${colors.green('✓ Build Completed')}\n\n` +
		`${colors.bold(colors.white('time:'))} ${colors.yellow(totalTime + 'ms')}\n` +
		`${colors.bold(colors.white('finished:'))} ${colors.gray(buildTimeStr)}\n\n` +
		perfSummary + '\n' + envSummary,
		{
			padding: { top: 0, left: 1, right: 1, bottom: 0 },
			margin: { top: 0, left: 0, right: 0, bottom: 1 },
			borderStyle: 'single',
			borderColor: 'cyan',
			title: 'Performance',
			titleAlignment: 'center'
		}
	);

	console.log(buildMessage);

	// Watcher status will be shown after server ready message
}

// FTP deployment with success tracking
let lastSuccessfulBuild = {
	js: false,
	css: false
};

function markBuildSuccess (type) {
	lastSuccessfulBuild[type] = true;
	// Only show build success marking in verbose mode
	const isVerbose = process.argv.includes('--verbose');
	if (isVerbose) {
		logBeautiful('info', 'Build Success Marked', `${type.toUpperCase()} is ready for deployment`);
	}
}

// BrowserSync instance
let bs = null;

// Auto-deploy mode state
let autoDeployMode = false;

// Track active operations for graceful shutdown
let activeOperations = new Set();
let isShuttingDown = false;

// Utility functions
function outputText (title = "Build Info", desc = "Build completed") {
	const boxedMessage = boxen(`\n${desc}\n`, {
		padding: { top: 1, left: 4, right: 4, bottom: 1 },
		title: title,
		margin: 1,
		titleAlignment: "center",
		borderStyle: "double",
		borderColor: "#ffc107",
	});
	console.log(boxedMessage);
}

function buildFinish (buildTime, showUrls = false) {
	const quietMode = process.argv.includes('--quiet');

	if (quietMode && !showUrls) {
		// Ultra-compact output for non-serve builds
		return;
	}

	const displayBoxen = () => {
		let message = `${colors.green('✓ Development Ready')}`;

		if (showUrls && bs && bs.active) {
			// Get the actual ports from BrowserSync instance
			const port = bs.getOption('port');
			const uiOptions = bs.getOption('ui');
			const uiPort = uiOptions && uiOptions.port ? uiOptions.port : (port + 1);

			// Get local IP address
			const { execSync } = require('child_process');
			let localIP = 'localhost';
			try {
				localIP = execSync("ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1", { encoding: 'utf-8' }).trim();
			} catch (e) {
				// Fallback if IP detection fails
				localIP = 'localhost';
			}

			message += `\n\n${colors.bold(colors.white('🌍 Access URLs:'))}`;
			message += `\nlocal: ${colors.cyan('http://localhost:' + port)}`;
			if (localIP !== 'localhost') {
				message += `\nexternal: ${colors.green('http://' + localIP + ':' + port)}`;
			}
			message += `\nui: ${colors.cyan('http://localhost:' + uiPort)}`;
			if (localIP !== 'localhost') {
				message += `\nui external: ${colors.green('http://' + localIP + ':' + uiPort)}`;
			}
		}

		if (buildTime && !quietMode) {
			message += `\n\nbuilt in ${colors.gray(buildTime + 'ms')}`;
		}

		// Use minimal boxen display
		const boxedMessage = boxen(message, {
			padding: { top: 1, left: 1, right: 1, bottom: 1 },
			margin: { top: 0, left: 0, right: 0, bottom: 1 },
			borderStyle: 'single',
			borderColor: 'green',
			titleAlignment: 'center',
			title: showUrls ? 'Server' : null
		});

		console.log(boxedMessage);
	};

	// For first build, add delay to ensure proper console display
	if (showUrls && buildStats.buildCount === 1) {
		setTimeout(displayBoxen, 150);
	} else {
		displayBoxen();
	}

	// Show file watcher status and auto-deploy info after server ready
	if (showUrls) {
		// Add delayed display to ensure proper console output
		const displayWatchStatus = () => {
			const watchMessage = `${colors.blue('🔍 Watch')} ${colors.white('monitoring files for changes')}\n${colors.gray('press')} ${colors.cyan('ctrl+c')} ${colors.gray('to exit')}`;

			const watchBox = boxen(watchMessage, {
				padding: { top: 0, left: 1, right: 1, bottom: 0 },
				margin: { top: 0, left: 0, right: 0, bottom: 0 },
				borderStyle: 'single',
				borderColor: 'blue'
			});

			console.log(watchBox);

			// Show auto-deploy status in boxen
			if (typeof autoDeployMode !== 'undefined') {
				const autoStatus = autoDeployMode ? colors.green('on') : colors.red('off');
				const deployMessage = `${colors.cyan('🚀 Deploy')} ${colors.white('auto-deploy:')} ${autoStatus} ${colors.gray('(Press d)')}`;

				const deployBox = boxen(deployMessage, {
					padding: { top: 0, left: 5, right: 5, bottom: 0 },
					margin: { top: 1, left: 0, right: 0, bottom: 0 },
					borderStyle: 'single',
					borderColor: autoDeployMode ? 'green' : 'red',
					title: autoDeployMode ? 'AUTO-DEPLOY' : 'MANUAL-DEPLOY'
				});

				console.log(deployBox);
			}
		};

		// For first startup, add delay to ensure proper display
		if (buildStats.buildCount === 1) {
			setTimeout(displayWatchStatus, 200);
		} else {
			displayWatchStatus();
		}
	}
}

// FTP Deployment Functions
async function createFtpConnection () {
	if (!ftpConfig) {
		console.log(logSymbols.error, "FTP config not loaded. Cannot create connection.");
		return null;
	}

	const client = new ftp.Client();
	client.ftp.verbose = false; // Disable verbose logging for cleaner output

	try {
		await client.access({
			host: ftpConfig.connection.host,
			user: ftpConfig.connection.user,
			password: ftpConfig.connection.password,
			secure: ftpConfig.connection.secure || false,
		});
		// FTP connection established - no need to log
		return client;
	} catch (error) {
		console.log(logSymbols.error, "FTP connection failed:", error.message);
		return null;
	}
}

function checkDistFolder () {
	const folderName = ftpConfig?.deployment?.localFolder || "dist";
	if (!fs.existsSync(folderName)) {
		console.log(
			"\n" + logSymbols.warning,
			colors.bgRed("run `npm run build` first!.") + "\n"
		);
		return false;
	}
	return true;
}

// Compilation verification helper
function verifyCompiledFiles (mappingKey) {
	const expectedFiles = {
		styles: ['dist/css/main.min.css', 'dist/css/core.min.css'],
		scripts: ['dist/js/main.min.js', 'dist/js/core.min.js'],
		all: ['dist/css/main.min.css', 'dist/css/core.min.css', 'dist/js/main.min.js', 'dist/js/core.min.js']
	};

	const filesToCheck = expectedFiles[mappingKey] || [];
	const missingFiles = filesToCheck.filter(file => !fs.existsSync(file));

	if (missingFiles.length > 0) {
		logBeautiful('warning', 'Compilation Verification Failed', `Missing compiled files: ${missingFiles.join(', ')}`);
		return false;
	}

	return true;
}

async function deployFiles (mappingKey) {
	// Track this operation for graceful shutdown
	const operationId = Symbol('deploy');
	activeOperations.add(operationId);

	let spinner = null;

	try {
		if (!ftpConfig || !checkDistFolder()) {
			return;
		}

		const mapping = ftpConfig.deployment.mappings[mappingKey];
		if (!mapping) {
			logBeautiful('error', 'FTP Deployment Failed', `Mapping "${mappingKey}" not found in FTP config`);
			return;
		}

		// Check if build was successful before deploying
		const buildType = mappingKey === 'styles' ? 'css' : mappingKey === 'scripts' ? 'js' : null;
		if (buildType && !lastSuccessfulBuild[buildType]) {
			logBeautiful('warning', 'Deployment Skipped', `${buildType.toUpperCase()} build not successful yet`);
			return;
		}

		// Verify compiled files exist before deploying
		if (!verifyCompiledFiles(mappingKey)) {
			logBeautiful('warning', 'Deployment Skipped', 'Compiled files verification failed');
			return;
		}

		// Start spinner BEFORE FTP connection to show immediate progress
		spinner = createSpinner(`Connecting to FTP server...`).start();

		const client = await createFtpConnection();
		if (!client) {
			if (spinner) spinner.fail('FTP connection failed');
			return;
		}

		spinner.text = `Deploying ${mapping.description}...`;

		try {
			const localPath = path.join(ftpConfig.deployment.localFolder, mapping.local);
			const remotePath = path.join(ftpConfig.deployment.basePath, mapping.remote).replace(/\\/g, '/');

			spinner.text = `Creating remote directory: ${remotePath}`;
			await client.ensureDir(remotePath);

			if (mapping.local === '.') {
				// Deploy all files from dist folder
				spinner.text = `Uploading files from ${ftpConfig.deployment.localFolder}`;
				await uploadDirectory(client, ftpConfig.deployment.localFolder, remotePath, mapping.exclude || [], null, spinner);
			} else {
				// Deploy specific folder
				if (fs.existsSync(localPath)) {
					spinner.text = `Uploading files from ${localPath}`;
					await uploadDirectory(client, localPath, remotePath, mapping.exclude || [], null, spinner);
				} else {
					if (spinner) spinner.fail(`Local path does not exist: ${localPath}`);
					return;
				}
			}

			// Show single clean deployment success line
			if (spinner) spinner.succeed(`${colors.cyan('🚀')} ${colors.white(mapping.description)} ${colors.green('deployed successfully')}`);
		} catch (error) {
			// Show single clean deployment error line
			if (spinner) spinner.fail(`${colors.red('✗')} ${colors.white(mapping.description)} ${colors.red('deployment failed:')} ${error.message}`);
			throw error;
		} finally {
			client.close();
		}
	} finally {
		// Always remove operation from tracking and ensure stdin is still responsive
		activeOperations.delete(operationId);
		ensureRawStdin(); // Belt-and-suspenders: restore stdin after FTP operation
	}
}

// Utility function to format file size
function formatFileSize (bytes) {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper function to upload directory recursively
async function uploadDirectory (client, localDir, remoteDir, excludePatterns = [], baseDir = null, spinner = null) {
	// Set baseDir for relative path calculation on first call
	if (!baseDir) baseDir = localDir;

	const items = fs.readdirSync(localDir, { withFileTypes: true });

	for (const item of items) {
		const localPath = path.join(localDir, item.name);
		const remotePath = path.posix.join(remoteDir, item.name);

		// Calculate relative path from base directory for display
		const relativePath = path.relative(baseDir, localPath);

		// Check if file should be excluded
		const shouldExclude = excludePatterns.some(pattern => {
			const regex = new RegExp(pattern.replace(/\*/g, '.*'));
			return regex.test(item.name);
		});

		if (shouldExclude) {
			continue;
		}

		if (item.isDirectory()) {
			await client.ensureDir(remotePath);
			await uploadDirectory(client, localPath, remotePath, excludePatterns, baseDir, spinner);
		} else {
			// Get file stats for size information
			const stats = fs.statSync(localPath);
			const fileSize = formatFileSize(stats.size);

			try {
				// Temporarily stop spinner to prevent interference
				if (spinner) {
					spinner.stop();
				}

				await client.uploadFrom(localPath, remotePath);
				console.log(`${relativePath} - ${fileSize} - ${colors.green('✓')} ${colors.gray('→')} ${colors.cyan(remotePath)}`);

				// Restart spinner if it was running
				if (spinner) {
					spinner.start();
					spinner.text = `Uploading files...`;
				}
			} catch (error) {
				if (spinner) {
					spinner.stop();
				}
				console.log(`${relativePath} - ${fileSize} - ${colors.red('✗ ' + error.message)} ${colors.gray('→')} ${colors.cyan(remotePath)}`);
				throw error;
			}
		}
	}
}

async function deployStyles () {
	return await deployFiles("styles");
}

async function deployScripts () {
	return await deployFiles("scripts");
}

async function deployImages () {
	return await deployFiles("images");
}

async function deployFonts () {
	return await deployFiles("fonts");
}

async function deployAll () {
	return await deployFiles("all");
}

// Auto-deploy toggle function
function toggleAutoDeploy () {
	autoDeployMode = !autoDeployMode;
	const statusIcon = autoDeployMode ? colors.green('✓') : colors.red('✗');
	const statusText = autoDeployMode ? colors.green('ON') : colors.red('OFF');

	// Show simple one-line toggle status
	console.log(`${colors.cyan('🚀')} ${colors.white('Auto-Deploy:')} ${statusText} ${statusIcon}`);

	return Promise.resolve();
}

// Clean and setup directories - matches cleanDist from gulp
function cleanDist () {
	if (fs.existsSync('dist')) {
		fs.rmSync('dist', { recursive: true, force: true });
	}

	// Create directory structure
	['dist', 'dist/js', 'dist/css', 'dist/img', 'dist/fonts'].forEach(dir => {
		fs.mkdirSync(dir, { recursive: true });
	});
}

function cleanImage () {
	if (fs.existsSync('dist/img')) {
		fs.rmSync('dist/img', { recursive: true, force: true });
	}
	fs.mkdirSync('dist/img', { recursive: true });
}

// Copy assets - matches copy.js tasks
function copyImage () {
	const imageExtensions = ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4'];
	const srcDir = 'src/assets/img';
	const destDir = 'dist/img';

	if (!fs.existsSync(srcDir)) return;

	function copyRecursive (src, dest) {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}

		const items = fs.readdirSync(src, { withFileTypes: true });

		items.forEach(item => {
			const srcPath = path.join(src, item.name);
			const destPath = path.join(dest, item.name);

			if (item.isDirectory()) {
				copyRecursive(srcPath, destPath);
			} else {
				const ext = path.extname(item.name).slice(1).toLowerCase();
				if (imageExtensions.includes(ext)) {
					fs.copyFileSync(srcPath, destPath);
				}
			}
		});
	}

	copyRecursive(srcDir, destDir);
}

function copyFonts () {
	config.font.forEach(fontGlob => {
		const fontDir = fontGlob.replace('/**', '');
		if (fs.existsSync(fontDir)) {
			const destDir = 'dist/fonts';
			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}

			function copyFontFiles (src, dest) {
				const items = fs.readdirSync(src, { withFileTypes: true });

				items.forEach(item => {
					const srcPath = path.join(src, item.name);
					const destPath = path.join(dest, item.name);

					if (item.isDirectory()) {
						if (!fs.existsSync(destPath)) {
							fs.mkdirSync(destPath, { recursive: true });
						}
						copyFontFiles(srcPath, destPath);
					} else {
						fs.copyFileSync(srcPath, destPath);
					}
				});
			}

			copyFontFiles(fontDir, destDir);
		}
	});
}

function copyFavicon () {
	if (fs.existsSync('src/assets/favicon.ico')) {
		fs.copyFileSync('src/assets/favicon.ico', 'dist/favicon.ico');
	}
}

// Note: generateVirtualCoreJSContent function removed - now using direct concatenation in buildCoreJS

// Core JS task - simple concatenation and minification without module systems
const buildCoreJS = trackTask('Core JS', async function buildCoreJS () {
	try {
		// Read and concatenate all JS files in memory
		let concatenatedContent = '';

		// Read and concatenate all JS files
		config.js.forEach(file => {
			const filePath = path.resolve(process.cwd(), file);
			if (fs.existsSync(filePath)) {
				concatenatedContent += `\n// === ${file} ===\n`;
				concatenatedContent += fs.readFileSync(filePath, 'utf8');
				concatenatedContent += '\n';
			} else {
				logBeautiful('warning', 'File not found', `Skipping missing file: ${file}`);
			}
		});

		// Use esbuild transform API for pure minification without module wrapping
		const result = await esbuild.transform(concatenatedContent, {
			minify: shouldMinify,
			target: ['es5'], // ES5 for maximum compatibility
			loader: 'js',
			sourcemap: isDev
		});

		// Write the minified result directly
		fs.writeFileSync('dist/js/core.min.js', result.code);

		// Write source map if in dev mode
		if (isDev && result.map) {
			fs.writeFileSync('dist/js/core.min.js.map', result.map);
		}

		// Reduce verbose success messages during build
		const isVerbose = process.argv.includes('--verbose');
		if (isVerbose) {
			logBeautiful('success', 'Core JS built successfully', `Bundle created: dist/js/core.min.js`);
		}
		markBuildSuccess('js'); // Mark core JS build as successful
	} catch (error) {
		logBeautiful('error', 'Core JS build failed', error.message);
		lastSuccessfulBuild.js = false;
		throw error;
	}
});

// Core CSS task - optimized with performance tracking
const buildCoreCSS = trackTask('Core CSS', async function buildCoreCSS () {
	try {
		// Fix path resolution by adding "./" prefix for relative paths
		const cssEntry = config.css.map(file => {
			if (file.startsWith('node_modules/') || file.startsWith('plugins/')) {
				return `@import './${file}';`;
			}
			return `@import '${file}';`;
		}).join('\n');
		fs.writeFileSync('temp-core-css.css', cssEntry);

		await esbuild.build({
			entryPoints: ['temp-core-css.css'],
			bundle: true,
			minify: shouldMinify,
			sourcemap: isDev,
			outfile: 'dist/css/core.min.css',
			loader: {
				'.css': 'css',
				'.woff': 'file',
				'.woff2': 'file',
				'.ttf': 'file',
				'.eot': 'file',
				'.svg': 'file',
			},
			external: ['../fonts/*'], // Ignore missing font files
			allowOverwrite: true,
		});

		// Apply PostCSS processing to match gulp workflow
		const cssContent = fs.readFileSync('dist/css/core.min.css', 'utf8');
		const postcssResult = await postcss([
			autoprefixer(),
			cssnano(),
			cssSort({ order: "concentric-css" }),
		]).process(cssContent, { from: 'dist/css/core.min.css' });

		// Write the processed CSS and add source map URL comment if in development mode
		let finalCss = postcssResult.css;
		if (isDev) {
			// Remove any existing incorrect source map URL and add the correct one
			finalCss = finalCss.replace(/\/\*# sourceMappingURL=.*?\*\/\s*$/g, '');
			finalCss += '\n/*# sourceMappingURL=core.min.css.map */';
		}
		fs.writeFileSync('dist/css/core.min.css', finalCss);

		// Cleanup
		if (fs.existsSync('temp-core-css.css')) {
			fs.unlinkSync('temp-core-css.css');
		}

		const isVerbose = process.argv.includes('--verbose');
		if (isVerbose) {
			logBeautiful('success', 'Core CSS built successfully', `Bundle created: dist/css/core.min.css`);
		}
		markBuildSuccess('css'); // Mark core CSS build as successful
	} catch (error) {
		logBeautiful('error', 'Core CSS build failed', error.message);
		lastSuccessfulBuild.css = false;
		throw error;
	}
});

// Main JS task - optimized with better error handling and performance tracking
const buildMainJS = trackTask('Main JS', async function buildMainJS () {
	try {
		await esbuild.build({
			entryPoints: ['src/js/main.js'],
			bundle: true,
			minify: shouldMinify,
			sourcemap: isDev ? 'inline' : false,
			outfile: 'dist/js/main.min.js',
			format: 'iife',
			globalName: 'App',
			target: ['es2015'],
			allowOverwrite: true,
			platform: 'browser',
			mainFields: ['browser', 'module', 'main'],
			// Better external handling for jQuery access
			external: [],
			define: {
				'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
			},
			resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
		});

		const isVerbose = process.argv.includes('--verbose');
		if (isVerbose) {
			logBeautiful('success', 'Main JS built successfully', `Bundle created: dist/js/main.min.js`);
		}
		markBuildSuccess('js');
	} catch (error) {
		logBeautiful('error', 'Main JS build failed', error.message);
		lastSuccessfulBuild.js = false;
		throw error;
	}
});

// SASS task - optimized with TailwindCSS JIT and better performance
const buildSASS = trackTask('SASS', async function buildSASS () {
	try {
		// Create SASS entry file that matches gulp sass task file pattern
		const sassFiles = [
			'src/components/_core/_**.sass',
			'src/components/_tailwind/*.sass',
			'src/components/_core/**.sass',
			'src/components/_global/**.sass',
			'src/components/**/**.sass'
		];

		// Collect all SASS files matching the patterns
		const collectSassFiles = (pattern) => {
			const baseDir = pattern.split('/*')[0];
			const isRecursive = pattern.includes('**');

			if (!fs.existsSync(baseDir)) return [];

			const files = [];

			function scanDirectory (dir, recursive = false) {
				const items = fs.readdirSync(dir, { withFileTypes: true });

				items.forEach(item => {
					const fullPath = path.join(dir, item.name);

					if (item.isDirectory() && recursive) {
						scanDirectory(fullPath, true);
					} else if (item.name.endsWith('.sass') || item.name.endsWith('.scss')) {
						files.push(fullPath);
					}
				});
			}

			scanDirectory(baseDir, isRecursive);
			return files;
		};

		// Collect all SASS files
		const allSassFiles = sassFiles.flatMap(collectSassFiles);

		// Create main SASS entry content (use SCSS syntax to avoid semicolon issues)
		const sassImports = allSassFiles.map(file => {
			// Normalize path separators to forward slashes for cross-platform compatibility
			const normalizedPath = file.replace(/\\/g, '/');

			return `@import "${normalizedPath}";`;
		}).join('\n');

		// Compile SASS directly from string with proper load paths
		const result = sass.compileString(sassImports, {
			style: 'expanded',
			sourceMap: true,
			sourceMapIncludeSources: true, // Include source contents in the map
			sourceMapRoot: path.resolve('.'), // Set predictable root path
			loadPaths: [
				'node_modules',
				'src/components',
				'src', // Add src as load path for absolute imports
				'.', // Add current directory
				'plugins' // Add plugins directory
			],
		});

		// Process with PostCSS (matches gulp postcss pipeline)
		const postcssOptions = {
			from: 'src/sass/main.scss', // Virtual entry path for better sourcemap labeling
			to: 'dist/css/main.min.css',
			map: {
				inline: false,
				annotation: false, // Disable automatic annotation to keep manual one accurate
				prev: result.sourceMap ? JSON.stringify(result.sourceMap) : undefined // Chain Sass sourcemap
			},
		};

		const postcssResult = await postcss([
			tailwindcss('./tailwind.config.js'),
			require('autoprefixer'),
			require('postcss-import'),
			...(shouldMinify ? [require('cssnano')] : []),
			cssSort({ order: "concentric-css" }),
		]).process(result.css, postcssOptions);

		// Write output
		let finalCss = postcssResult.css;

		// Add source map URL comment if not already present
		if (postcssResult.map && !finalCss.includes('/*# sourceMappingURL=')) {
			finalCss += '\n/*# sourceMappingURL=main.min.css.map */';
		}

		fs.writeFileSync('dist/css/main.min.css', finalCss);

		if (postcssResult.map) {
			fs.writeFileSync('dist/css/main.min.css.map', postcssResult.map.toString());
		}

		const isVerbose = process.argv.includes('--verbose');
		if (isVerbose) {
			logBeautiful('success', 'SASS built successfully', `CSS compiled: dist/css/main.min.css`);
		}
		markBuildSuccess('css');

		// Trigger BrowserSync reload if in serve mode
		if (bs && bs.active) {
			bs.reload('*.css');
		}

	} catch (error) {
		logBeautiful('error', 'SASS build failed', error.message);
		lastSuccessfulBuild.css = false;
		throw error;
	}
});

// Pug task - matches pug.js from gulp
function buildPugTemplates () {
	try {
		let filesToProcess = [];

		if (pagesConfig.all || pagesConfig.pages.length === 0) {
			// Build all .pug files in src/pages (excluding partials starting with _)
			filesToProcess = fs.readdirSync('src/pages')
				.filter(file => file.endsWith('.pug') && !file.startsWith('_'))
				.map(file => path.join('src/pages', file));
		} else {
			// Build only enabled pages
			filesToProcess = pagesConfig.pages
				.filter(page => page.enabled)
				.map(page => path.join('src/pages', page.src))
				.filter(filePath => fs.existsSync(filePath));
		}

		filesToProcess.forEach(inputPath => {
			const fileName = path.basename(inputPath);
			const outputPath = path.join('dist', fileName.replace('.pug', '.html'));

			try {
				const html = pug.renderFile(inputPath, {
					pretty: "\t", // Match gulp pug task formatting
					compileDebug: isDev,
					basedir: 'src', // Allow absolute imports from src
				});

				fs.writeFileSync(outputPath, html);
				// Only show individual file compilation in verbose mode
				const isVerbose = process.argv.includes('--verbose');
				if (isVerbose) {
					console.log(`✅ Compiled: ${fileName} -> ${path.basename(outputPath)}`);
				}
			} catch (pugError) {
				console.error(`❌ Pug compilation failed for ${fileName}:`, pugError.message);
			}
		});

		const isVerbose = process.argv.includes('--verbose');
		if (isVerbose) {
			console.log('✅ Pug templates built successfully');
		}

		// Trigger BrowserSync reload if in serve mode
		if (bs && bs.active) {
			bs.reload();
		}

	} catch (error) {
		console.error('❌ Pug build failed:', error);
	}
}

// Main build function - optimized with beautiful logging and performance tracking
async function build () {
	buildStats.start = Date.now();
	buildStats.buildCount++;
	buildStats.tasks = {}; // Reset task timings for this build

	const isFirstBuild = buildStats.buildCount === 1;
	const quietMode = process.argv.includes('--quiet');

	if (!quietMode || isFirstBuild) {
		logBeautiful('start', 'Starting ESBuild Process', `Mode: ${isDev ? 'Development' : 'Production'}`);
	}

	const spinnerText = isFirstBuild ? '🚀 Initializing ESBuild process...' : '♾️ Rebuilding...';
	const spinner = createSpinner(spinnerText).start();

	try {
		// Step 1: Clean dist directory
		spinner.text = '🧹 Cleaning output directory...';
		cleanDist();

		// Step 2: Copy assets in parallel (optimized)
		spinner.text = '📁 Copying assets (images, fonts, favicon)...';
		await Promise.all([
			trackTask('Copy Images', async () => copyImage())(),
			trackTask('Copy Fonts', async () => copyFonts())(),
			trackTask('Copy Favicon', async () => copyFavicon())()
		]);

		// Step 3: Build core assets in parallel
		spinner.text = '⚙️ Building core assets (JS + CSS)...';
		await Promise.all([
			buildCoreJS(),
			buildCoreCSS(),
		]);

		// Step 4: Build templates and main assets
		spinner.text = '📜 Building Pug templates...';
		await trackTask('Pug Templates', async () => buildPugTemplates())();

		spinner.text = '🎨 Compiling SASS + Tailwind CSS...';
		await buildSASS();

		spinner.text = '🔧 Bundling main JavaScript...';
		await buildMainJS();

		buildStats.end = Date.now();
		const buildTime = buildStats.end - buildStats.start;
		buildStats.lastSuccessfulBuild = Date.now();

		const isFirstBuild = buildStats.buildCount === 1;
		const successMessage = isFirstBuild ?
			`Build completed successfully in ${buildTime}ms` :
			`Rebuilt in ${buildTime}ms`;

		spinner.succeed(successMessage);

		// Force show detailed stats on first build or when verbose
		if (isFirstBuild || process.argv.includes('--verbose')) {
			// Add small delay to ensure console output is not suppressed
			setTimeout(() => {
				showBuildStats();
			}, 50);
		} else if (!process.argv.includes('--quiet')) {
			// Quick rebuild notification
			console.log(`${colors.green('✓')} ${colors.white('Ready')} ${colors.gray('(' + buildTime + 'ms)')}`);
		}

		return buildTime;

	} catch (error) {
		spinner.fail('Build failed!');
		logBeautiful('error', 'Build Failed', error.message);
		throw error;
	}
}

// Core build function (matches gulp core task)
async function buildCore () {
	console.log('🚀 Starting core build...');
	const startTime = Date.now();

	try {
		cleanDist();

		// Copy assets
		copyImage();
		copyFonts();
		copyFavicon();

		// Build core assets
		await Promise.all([
			buildCoreJS(),
			buildCoreCSS(),
		]);

		const endTime = Date.now();
		const buildTime = endTime - startTime;
		console.log(`✅ Core build completed in ${buildTime}ms`);

		buildFinish(buildTime);

	} catch (error) {
		console.error('❌ Core build failed:', error);
		throw error;
	}
}

// Keyboard shortcuts functionality
function initKeyboardShortcuts () {
	if (!ftpConfig) {
		console.log('⚠️  FTP config not loaded. Keyboard shortcuts for deployment disabled.');
		return;
	}

	// Safety check for ftpConfig.shortcuts
	if (!ftpConfig.shortcuts || typeof ftpConfig.shortcuts !== 'object') {
		console.log('⚠️  FTP shortcuts config not found. Keyboard shortcuts disabled.');
		return;
	}

	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.setEncoding("utf8");

	// Build shortcuts description from config in compact format
	let shortcutsText = "";
	Object.entries(ftpConfig.shortcuts).forEach(([key, config]) => {
		// Use chalk for more reliable color support
		shortcutsText += `  ${chalk.bgWhite.black(` ${key.toUpperCase()} `)} ${chalk.white(config.description)}\n`;
	});

	console.log(
		boxen(
			shortcutsText,
			{
				title: 'Keyboard Shortcuts',
				titleAlignment: 'center',
				padding: { top: 1, left: 2, right: 2, bottom: 0 },
				margin: { top: 1, left: 0, right: 0, bottom: 1 },
				borderStyle: "single",
				borderColor: "#FFB823",
			}
		)
	);

	// Store the original SIGINT handler
	const originalSigIntHandler = process.listeners("SIGINT")[0];

	// Remove the original handler to prevent duplicate handlers
	if (originalSigIntHandler) {
		process.removeListener("SIGINT", originalSigIntHandler);
	}

	// stdin handler - DO NOT make async or await, it blocks subsequent keypresses!
	process.stdin.on("data", function (key) {
		// Ctrl+C to exit - properly handle termination
		if (key === "\u0003") {
			handleExit(); // Don't await - let it run async
			return;
		}

		// Clean the key by trimming whitespace and taking only the first character
		const keyLower = key.toString().trim().toLowerCase().charAt(0);

		if (!keyLower) return; // Skip empty keys

		const shortcut = ftpConfig.shortcuts[keyLower];

		if (shortcut) {
			// Provide immediate feedback to user
			console.log(`${colors.cyan('⌨️')} ${colors.white('Command received:')} ${colors.yellow(shortcut.description)}`);

			// Run task WITHOUT await - fire and forget to keep handler responsive
			// The task itself is async and will complete in background
			runTask(shortcut.action).catch(error => {
				console.log(`${colors.red('✗')} ${colors.red('Command failed:')} ${error.message}`);
			});
		}
	});

	// Add a clean exit handler for SIGINT (Ctrl+C)
	process.on("SIGINT", handleExit);

	async function handleExit () {
		// Prevent multiple simultaneous exit calls
		if (isShuttingDown) return;
		isShuttingDown = true;

		console.log("\n\t" + logSymbols.info, "Shutting down gracefully...\n");

		// Wait for active operations to complete (with timeout)
		if (activeOperations.size > 0) {
			console.log(`${colors.yellow('⏳')} Waiting for ${activeOperations.size} operation(s) to complete...`);

			// Create a timeout promise
			const timeout = new Promise(resolve => setTimeout(resolve, 5000));

			// Wait for all operations or timeout (whichever comes first)
			await Promise.race([
				Promise.all(Array.from(activeOperations).map(() =>
					// Each operation is tracked, we just wait a bit
					new Promise(resolve => setTimeout(resolve, 100))
				)),
				timeout
			]);

			if (activeOperations.size > 0) {
				console.log(`${colors.yellow('⚠️')} Forcing exit (${activeOperations.size} operation(s) still active)`);
			}
		}

		// Clean up input handling
		if (process.stdin.isTTY && process.stdin.setRawMode) {
			process.stdin.setRawMode(false);
		}
		process.stdin.pause();
		process.stdin.removeAllListeners("data");

		// Close BrowserSync if running
		if (bs && bs.active) {
			await new Promise(resolve => {
				bs.exit();
				setTimeout(resolve, 100); // Give it time to clean up
			});
		}

		process.exit(0);
	}
}

// Function to run a task
async function runTask (taskName) {
	try {
		let taskPromise;

		switch (taskName) {
			case 'build':
				const buildTime = await build();
				buildFinish(buildTime);
				return; // Early return since we handle completion here
			case 'deployStyles':
				taskPromise = deployStyles();
				break;
			case 'deployScripts':
				taskPromise = deployScripts();
				break;
			case 'deployImages':
				taskPromise = deployImages();
				break;
			case 'deployFonts':
				taskPromise = deployFonts();
				break;
			case 'deployAll':
				taskPromise = deployAll();
				break;
			case 'toggleAutoDeploy':
				taskPromise = toggleAutoDeploy();
				return; // Early return for toggle, no additional messages needed
			default:
				console.log(logSymbols.error, `Unknown task: ${taskName}`);
				return;
		}

		await taskPromise;
		// Task completion is now handled by deployFiles spinner messages
	} catch (error) {
		// Error handling is now done by deployFiles function
		console.log(`${colors.red('✗')} ${colors.red(taskName + ' failed:')} ${error.message}`);
	}
}

// Helper function to find an available port
async function findAvailablePort (startPort = 7979) {
	const net = require('net');

	return new Promise((resolve) => {
		const server = net.createServer();

		server.listen(startPort, () => {
			const port = server.address().port;
			server.close(() => resolve(port));
		});

		server.on('error', () => {
			// Port is in use, try the next one
			resolve(findAvailablePort(startPort + 1));
		});
	});
}

// Development server - matches server.js from gulp
async function startServer () {
	try {
		// Find an available port starting from 7979
		const availablePort = await findAvailablePort(7979);

		// Initialize BrowserSync with quieter output
		bs = browserSync.create();

		// Find available UI port as well
		const availableUIPort = await findAvailablePort(availablePort + 1);

		// Suppress BrowserSync's verbose startup messages
		const originalLog = console.log;
		const originalInfo = console.info;

		// Temporarily suppress BrowserSync logs
		console.log = () => { };
		console.info = () => { };

		bs.init({
			notify: false, // Disable browser notifications
			host: '0.0.0.0', // Allow external access
			server: {
				baseDir: "dist",
			},
			port: availablePort,
			ui: {
				port: availableUIPort,
				host: '0.0.0.0' // Allow external access to UI
			},
			logLevel: 'silent', // Reduce BrowserSync logging
			open: false // Don't auto-open browser
		}, async () => {
			// Restore console after BrowserSync init
			console.log = originalLog;
			console.info = originalInfo;

			// Add small delay to ensure console is fully restored
			await new Promise(resolve => setTimeout(resolve, 100));

			const quietMode = process.argv.includes('--quiet');
			if (!quietMode) {
				logBeautiful('start', 'Development Server', `Starting at http://localhost:${availablePort}`);
			}

			// Initial build AFTER console restoration
			const buildTime = await build();

			// Setup file watchers (matches gulp watch tasks)
			setupWatchers();

			// Initialize keyboard shortcuts for FTP deployment
			initKeyboardShortcuts();

			// Show final message with URLs - force display
			buildFinish(buildTime, true);
		});

	} catch (error) {
		console.error('❌ Server start failed:', error);
		throw error;
	}
}

// Auto-deploy helper function
async function autoDeployIfEnabled (fileType, changedPath) {
	if (!autoDeployMode || !ftpConfig) return;

	console.log(`🚀 Auto-deploy triggered for ${fileType} file: ${path.basename(changedPath)}`);

	try {
		if (fileType === 'styles') {
			await deployStyles();
		} else if (fileType === 'scripts') {
			await deployScripts();
		}
	} catch (error) {
		console.log(logSymbols.error, `Auto-deploy failed:`, error.message);
	}
}

// Enhanced file watchers with beautiful logging
function setupWatchers () {
	// Watch JS files - optimized with debouncing
	let jsTimeout = null;
	chokidar.watch(['src/js/*.js'], { ignoreInitial: true }).on('change', async (changedPath) => {
		if (jsTimeout) clearTimeout(jsTimeout);
		jsTimeout = setTimeout(async () => {
			const startTime = Date.now();
			try {
				// Step 1: Compile JS first
				await buildMainJS();

				// Step 2: Reload browser after successful compilation
				if (bs && bs.active) bs.reload();

				// Step 3: Deploy only after successful compilation
				await autoDeployIfEnabled('scripts', changedPath);

				const compileTime = Date.now() - startTime;
				console.log(`${colors.cyan('⚙️')} ${colors.cyan('JS changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.cyan('⚙️')} ${colors.yellow(compileTime + 'ms')}`);
			} catch (error) {
				// Don't deploy if compilation failed
				const compileTime = Date.now() - startTime;
				console.log(`${colors.cyan('⚙️')} ${colors.cyan('JS changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.red('✗')} ${colors.yellow(compileTime + 'ms')} ${colors.red('(' + error.message + ')')}`);
			}
		}, 150);
	});

	// Watch Pug files (matches: watch(["src/**/**.pug"], series(pugTask, sassTask, previewReload)))
	chokidar.watch(['src/**/*.pug']).on('change', async (changedPath) => {
		const startTime = Date.now();

		try {
			// Step 1: Compile Pug templates first
			buildPugTemplates();

			// Step 2: Compile SASS after Pug
			await buildSASS();

			// Step 3: Reload browser after successful compilation
			if (bs && bs.active) bs.reload();

			// Step 4: Deploy only after successful compilation
			await autoDeployIfEnabled('styles', changedPath);

			const compileTime = Date.now() - startTime;
			console.log(`${colors.blue('✏️')} ${colors.blue('Pug changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.cyan('⚙️')} ${colors.yellow(compileTime + 'ms')}`);
		} catch (error) {
			// Don't deploy if compilation failed
			const compileTime = Date.now() - startTime;
			console.log(`${colors.blue('✏️')} ${colors.blue('Pug changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.red('✗')} ${colors.yellow(compileTime + 'ms')} ${colors.red('(' + error.message + ')')}`);
		}
	});

	// Watch SASS files (matches: watch(["src/components/**/*.sass"], series(sassTask)))
	chokidar.watch(['src/components/**/*.sass']).on('change', async (changedPath) => {
		const startTime = Date.now();

		try {
			// Step 1: Compile SASS first
			await buildSASS();

			// Show compile completion immediately after SASS build
			const compileTime = Date.now() - startTime;
			console.log(`${colors.magenta('🎨')} ${colors.magenta('SASS changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.cyan('⚙️')} ${colors.yellow(compileTime + 'ms')}`);

			// Step 2: Deploy only after successful compilation and logging
			await autoDeployIfEnabled('styles', changedPath);
		} catch (error) {
			// Don't deploy if compilation failed
			const compileTime = Date.now() - startTime;
			console.log(`${colors.magenta('🎨')} ${colors.magenta('SASS changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.red('✗')} ${colors.yellow(compileTime + 'ms')} ${colors.red('(' + error.message + ')')}`);
		}
	});

	// Watch image files (matches: watch image pattern with cleanImage, copyImage)
	chokidar.watch(['src/assets/img/**/*.{svg,png,jpg,jpeg,gif,webp,mp4}'])
		.on('change', async (changedPath) => {
			const startTime = Date.now();
			const isVerbose = process.argv.includes('--verbose');

			cleanImage();
			copyImage();

			if (isVerbose) {
				const copyTime = Date.now() - startTime;
				console.log(`${colors.green('🖼️')} ${colors.green('Image changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.cyan('⚙️')} ${colors.yellow(copyTime + 'ms')}`);
			}
		})
		.on('add', async (addedPath) => {
			const isVerbose = process.argv.includes('--verbose');
			if (isVerbose) {
				console.log(`image added: ${path.basename(addedPath)}`);
			}
			// Copy only the new file, not all images
			const relativePath = path.relative('src/assets/img', addedPath);
			const destPath = path.join('dist/img', relativePath);
			const destDir = path.dirname(destPath);

			// Ensure destination directory exists
			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}

			// Copy only the new file
			fs.copyFileSync(addedPath, destPath);
			if (isVerbose) {
				console.log(`copied: ${relativePath}`);
			}
		})
		.on('unlink', async (removedPath) => {
			const isVerbose = process.argv.includes('--verbose');
			if (isVerbose) {
				console.log(`image removed: ${path.basename(removedPath)}`);
			}
			// Remove only the specific file from dist
			const relativePath = path.relative('src/assets/img', removedPath);
			const destPath = path.join('dist/img', relativePath);

			if (fs.existsSync(destPath)) {
				fs.unlinkSync(destPath);
				if (isVerbose) {
					console.log(`removed: ${relativePath}`);
				}
			}
		});

	// Watch config files
	chokidar.watch(['config.json', 'pages.json']).on('change', async (changedPath) => {
		const startTime = Date.now();

		// Reload config
		const newConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
		const newPagesConfig = JSON.parse(fs.readFileSync('pages.json', 'utf8'));
		Object.assign(config, newConfig);
		Object.assign(pagesConfig, newPagesConfig);

		const buildTime = await build();
		buildFinish(buildTime);

		const totalTime = Date.now() - startTime;
		console.log(`${colors.yellow('⚙️')} ${colors.yellow('Config changed:')} ${colors.white(path.basename(changedPath))} ${colors.gray('-')} ${colors.cyan('⚙️')} ${colors.yellow(totalTime + 'ms')}`);
	});

	// Auto-deploy status is now shown in buildFinish function
}

// Build pages task - matches build-pages.js from gulp
function updatePagesTask () {
	try {
		const pagesPath = "src/pages";
		const pagesJsonPath = "pages.json";

		const currentPagesJson = JSON.parse(fs.readFileSync(pagesJsonPath, "utf-8"));
		const pages = currentPagesJson.pages || [];

		const files = fs.readdirSync(pagesPath);
		let newPagesCount = 0;

		for (const file of files) {
			if (file.endsWith(".pug") && file !== "_layout.pug") {
				const existingPage = pages.find(page => page.src === file);
				if (!existingPage) {
					pages.push({ enabled: false, src: file });
					newPagesCount++;
				}
			}
		}

		currentPagesJson.pages = pages;
		fs.writeFileSync(pagesJsonPath, JSON.stringify(currentPagesJson, null, 2));

		if (newPagesCount > 0) {
			outputText('Add File to Pages.json', `Added ${newPagesCount} new pages to pages.json`);
		} else {
			console.log('✅ Pages.json is up to date');
		}

	} catch (error) {
		console.error('❌ Update pages task failed:', error);
	}
}

// Main execution logic - default to watch mode for development
async function main () {
	const command = process.argv[2];

	try {
		switch (command) {
			case 'core':
				await buildCore();
				break;

			case 'pages':
				updatePagesTask();
				break;

			case 'build':
			case '--build-only':
				const buildTime = await build();
				logBeautiful('success', 'Build Complete', `Finished in ${buildTime}ms`);
				break;

			case 'serve':
			default:
				// Default behavior: Start development server with watch mode
				await startServer();
				break;
		}
	} catch (error) {
		logBeautiful('error', 'Command Failed', error.message);
		process.exit(1);
	}
}

// Handle process termination - SIGTERM only (SIGINT is handled in initKeyboardShortcuts)
process.on('SIGTERM', () => {
	console.log('\n🛑 Build process terminated');
	if (bs && bs.active) {
		bs.exit();
	}
	process.exit(0);
});

// Run main function
main();
