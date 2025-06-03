import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'node:fs'
import path from 'node:path'

// Ensure assets directory exists
const ensureAssetsDir = () => {
  const assetsDir = resolve(__dirname, 'public/assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true, mode: 0o755 });
  }
  // Ensure subdirectories exist
  ['logos', 'icons', 'header'].forEach(subdir => {
    const subDirPath = resolve(assetsDir, subdir);
    if (!fs.existsSync(subDirPath)) {
      fs.mkdirSync(subDirPath, { recursive: true, mode: 0o755 });
    }
  });
  return assetsDir;
};

// Copy assets to public directory for dev/preview
const assetFiles = [
  'src/assets/logos/bls_icon_dark.png',
  'src/assets/logos/bls_icon_light.png',
  'src/assets/icons/icon16.png',
  'src/assets/icons/icon32.png',
  'src/assets/icons/icon48.png',
  'src/assets/icons/icon128.png',
  'src/assets/header/black_lantern_logo_dark.svg',
  'src/assets/header/black_lantern_logo_light.svg',
];

const assetsDir = ensureAssetsDir();
assetFiles.forEach(file => {
  const srcPath = resolve(__dirname, file);
  if (!fs.existsSync(srcPath)) {
    console.error(`Source file does not exist: ${srcPath}`);
    return;
  }
  const relativePath = file.replace('src/assets/', '');
  const destPath = resolve(assetsDir, relativePath);
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true, mode: 0o755 });
  }
  try {
    fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE);
  } catch (err) {
    console.error(`Error copying ${srcPath} to ${destPath}:`, err);
  }
});

const copyAssets = {
  name: 'copy-assets',
  closeBundle() {
    if (!fs.existsSync(resolve(__dirname, 'dist/assets'))) {
      fs.mkdirSync(resolve(__dirname, 'dist/assets'), { recursive: true, mode: 0o755 });
    }
    // Ensure subdirectories exist in dist/assets
    ['logos', 'icons', 'header'].forEach(subdir => {
      const subDirPath = resolve(__dirname, 'dist/assets', subdir);
      if (!fs.existsSync(subDirPath)) {
        fs.mkdirSync(subDirPath, { recursive: true, mode: 0o755 });
      }
    });
    assetFiles.forEach(file => {
      const srcPath = resolve(__dirname, file);
      if (!fs.existsSync(srcPath)) {
        console.error(`Source file does not exist: ${srcPath}`);
        return;
      }
      try {
        const relativePath = file.replace('src/assets/', '');
        const destPath = resolve(__dirname, 'dist/assets', relativePath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true, mode: 0o755 });
        }
        fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE);
      } catch (err) {
        console.error(`Error copying ${srcPath} to ${destPath}:`, err);
      }
    });
  }
};

const copyManifest = {
  name: 'copy-manifest',
  closeBundle() {
    try {
      fs.copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));
      fs.copyFileSync(resolve(__dirname, 'background.js'), resolve(__dirname, 'dist/background.js'));
      // Optionally copy the host/ directory
      if (!fs.existsSync(resolve(__dirname, 'dist/host'))) {
        fs.mkdirSync(resolve(__dirname, 'dist/host'), { recursive: true, mode: 0o755 });
      }
      fs.copyFileSync(resolve(__dirname, 'host/bbot_host.json'), resolve(__dirname, 'dist/host/bbot_host.json'));
      fs.copyFileSync(resolve(__dirname, 'host/bbot_host.py'), resolve(__dirname, 'dist/host/bbot_host.py'));
    } catch (err) {
      console.error('Error copying manifest or host files:', err);
    }
  }
};

export default defineConfig({
  server: {
    port: 8000
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info.pop();
          const name = info.join('.');
          return `assets/${name}.${ext}`;
        },
        chunkFileNames: '[name].[hash].js',
        entryFileNames: '[name].[hash].js'
      }
    },
    manifest: true
  },
  plugins: [react(), copyManifest, copyAssets]
})
