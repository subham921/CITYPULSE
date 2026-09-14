const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'server', 'public', 'dist');
const dest = path.join(__dirname, '..', 'dashboard');

if (!fs.existsSync(src)) {
  console.log('[Sync Build] Source dist does not exist:', src);
  process.exit(0);
}

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'uploads') continue;
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(src, dest);
console.log('[Sync Build] Synchronized compiled React bundle to dashboard/');
