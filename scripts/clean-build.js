import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to clean console.warn statements from HTML files
function cleanConsoleWarns(distPath) {
  const htmlFiles = fs.readdirSync(distPath).filter(file => file.endsWith('.html'));
  
  htmlFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove the console.warn statement from the legacy plugin
    const consoleWarnPattern = /console\.warn\("vite: loading legacy chunks, syntax error above and the same error below should be ignored"\);?/g;
    
    if (content.includes('console.warn("vite: loading legacy chunks')) {
      content = content.replace(consoleWarnPattern, '');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Cleaned console.warn from ${file}`);
    }
  });
}

// Run the cleaning
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  cleanConsoleWarns(distPath);
  console.log('✅ Build files cleaned successfully');
} else {
  console.error('❌ dist directory not found');
  process.exit(1);
}