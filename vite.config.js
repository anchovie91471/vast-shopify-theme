import shopify from 'vite-plugin-shopify'
import cleanup from '@by-association-only/vite-plugin-shopify-clean'
import pageReload from 'vite-plugin-page-reload'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from "@tailwindcss/vite"

import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

// Monkey-patch fs.writeFileSync to prevent unnecessary vite.liquid writes
const originalWriteFileSync = fs.writeFileSync;
const viteSnippetPath = path.resolve(process.cwd(), 'snippets', 'vite.liquid');
let lastViteSnippetContent = null;

// Try to read existing content on startup
try {
    lastViteSnippetContent = fs.readFileSync(viteSnippetPath, 'utf-8');
} catch (err) {
    // File doesn't exist yet, that's OK
}

fs.writeFileSync = function(filePath, content, options) {
    // Check if this is a write to snippets/vite.liquid
    const resolvedPath = typeof filePath === 'string' ? path.resolve(filePath) : filePath;

    if (resolvedPath === viteSnippetPath || resolvedPath.toString().endsWith('snippets/vite.liquid')) {
        const contentStr = content.toString();

        // Only prevent duplicate writes in watch mode (not one-time builds)
        if (process.argv.includes('--watch') && contentStr === lastViteSnippetContent) {
            return; // Don't write, return early
        }

        lastViteSnippetContent = contentStr;
    }

    // Call original function for all other files or when content changed
    return originalWriteFileSync.call(fs, filePath, content, options);
};

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(src, dest);
}

function removeFile(dest) {
    if (fs.existsSync(dest)) {
        try {
            fs.unlinkSync(dest);
        } catch (err) {
            console.error(`Failed to remove file: ${dest}`);
        }
    }
}

function copyPublicToAssetsPlugin() {
    let config;
    let watcher;

    return {
        name: 'vite-plugin-copy-public',
        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },
        closeBundle() {
            // This runs after each build completes (both initial and watch rebuilds)
            const publicDir = path.resolve(config.root, 'public');
            const assetsDir = path.resolve(config.root, 'assets');

            // Detect if we're in watch mode (dev server or vite build --watch)
            const isWatchMode = config.command === 'serve' || config.build.watch;

            if (!watcher && isWatchMode) {
                // In watch mode: Set up file watcher
                // Ignore snippets/vite.liquid to prevent triggering this watcher
                watcher = chokidar.watch(publicDir, {
                    ignoreInitial: false,
                    ignored: [
                        '**/snippets/vite.liquid',
                        path.resolve(config.root, 'snippets', 'vite.liquid')
                    ]
                });

                watcher.on('add', (filePath) => {
                    const relativePath = path.relative(publicDir, filePath);
                    const destPath = path.resolve(assetsDir, relativePath);
                    copyFile(filePath, destPath);
                });

                watcher.on('change', (filePath) => {
                    const relativePath = path.relative(publicDir, filePath);
                    const destPath = path.resolve(assetsDir, relativePath);
                    console.log(`[public] Updated: ${relativePath}`);
                    copyFile(filePath, destPath);
                });

                watcher.on('unlink', (filePath) => {
                    const relativePath = path.relative(publicDir, filePath);
                    const destPath = path.resolve(assetsDir, relativePath);
                    console.log(`[public] Removed: ${relativePath}`);
                    removeFile(destPath);
                });
            } else if (!isWatchMode && !watcher) {
                // In regular build mode: Do one-time copy and exit cleanly
                if (fs.existsSync(publicDir)) {
                    const files = fs.readdirSync(publicDir, { recursive: true });
                    files.forEach(file => {
                        const srcPath = path.resolve(publicDir, file);
                        if (fs.statSync(srcPath).isFile()) {
                            const destPath = path.resolve(assetsDir, file);
                            copyFile(srcPath, destPath);
                        }
                    });
                }
            }
        },
    };
}

export default {
    clearScreen: false,
    server: {
        host: '127.0.0.1',
        https: true,
        port: 3000,
        hmr: true,
        cors: {
            origin: [
                /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
                /^https:\/\/[^\/]+\.myshopify\.com$/
            ]
        },
        watch: {
            ignored: [
                '**/snippets/vite.liquid',
                '**/assets/**'
            ]
        }
    },
    publicDir: 'public',
    build: {
        manifest: "vite-manifest.json",
        emptyOutDir: false,
        minify: process.env.NODE_ENV === 'production', // Skip minification in development for faster builds
        sourcemap: process.env.NODE_ENV === 'development', // Add sourcemaps in development for debugging
        watch: process.argv.includes('--watch') ? {
            // Chokidar options to stabilize file watching
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 100
            },
            ignored: (testPath) => {
                // Function-based ignore for explicit control
                const viteSnippetPath = path.resolve(process.cwd(), 'snippets', 'vite.liquid');
                const assetsPath = path.resolve(process.cwd(), 'assets');

                // Ignore vite.liquid file (prevents rebuild loop)
                if (testPath === viteSnippetPath || testPath.endsWith('snippets/vite.liquid')) {
                    return true;
                }

                // Ignore entire assets directory
                if (testPath.startsWith(assetsPath + path.sep) || testPath === assetsPath) {
                    return true;
                }

                return false; // Don't ignore other files
            }
        } : null, // Disable watch mode for one-time builds
        rollupOptions: {
            input: {
                theme: path.resolve(process.cwd(), 'src/entrypoints/theme.js'),
                'theme.css': path.resolve(process.cwd(), 'src/entrypoints/theme.css'),
                product: path.resolve(process.cwd(), 'src/entrypoints/product.js'),
                collection: path.resolve(process.cwd(), 'src/entrypoints/collection.js'),
                blog: path.resolve(process.cwd(), 'src/entrypoints/blog.js'),
            },
            watch: {
                // Rollup-specific watch configuration
                exclude: [
                    'snippets/vite.liquid',  // Only exclude vite.liquid, not all snippets
                    'assets/**'
                ]
            },
            output: {
                entryFileNames: '[name].[hash].min.js',
                chunkFileNames: '[name].[hash].min.js',
                assetFileNames: '[name].[hash].min[extname]',
            },
        }
    },
    plugins: [
        // Enable Chrome's Private Network Access for requests from public Shopify domains to local dev server
        {
            name: 'configure-response-headers',
            configureServer: (server) => {
                server.middlewares.use((_req, res, next) => {
                    res.setHeader('Access-Control-Allow-Private-Network', 'true');
                    next();
                });
            }
        },
        basicSsl(),
        cleanup({
            manifestFileName: 'vite-manifest.json'
        }),
        copyPublicToAssetsPlugin(),
        tailwindcss(),
        shopify({
            sourceCodeDir: "src",
            entrypointsDir: 'src/entrypoints',
            snippetFile: "vite.liquid",
        }),
        pageReload('/tmp/theme.update', {
            delay: 2000
        }),
        {
            name: 'vite-plugin-liquid-tailwind-refresh',
            handleHotUpdate(ctx) {
                if (ctx.file.endsWith('.liquid')) {
                    // Filter out the liquid module to prevent a full refresh
                    return [...ctx.modules[0]?.importers ?? [], ...ctx.modules.slice(1)]
                }
            }
        },
        // Defensively clean up .vite subdirectory if it gets created (Shopify doesn't allow subdirectories)
        {
            name: 'remove-vite-subdirectory',
            enforce: 'post',  // Run after vite-plugin-shopify
            closeBundle: {
                sequential: true,  // Wait for all parallel closeBundle hooks to finish first
                async handler() {
                    const viteDir = path.resolve(process.cwd(), 'assets', '.vite');
                    if (fs.existsSync(viteDir)) {
                        fs.rmSync(viteDir, { recursive: true, force: true });
                    }
                }
            }
        }
    ],
}
