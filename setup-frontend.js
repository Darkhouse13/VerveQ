#!/usr/bin/env node

/**
 * VerveQ Frontend Setup Script
 * Installs dependencies with exact versions and sets up the development environment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Setting up VerveQ Frontend Build Process...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18+ is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log('✅ Node.js version check passed:', nodeVersion);

// Install dependencies with exact versions
console.log('\n📦 Installing dependencies with exact versions...');

try {
  // Install exact versions to ensure reproducible builds
  execSync('npm install --save-exact', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create .env.local if it doesn't exist
const envLocalPath = '.env.local';
const envExamplePath = '.env.example';

if (!fs.existsSync(envLocalPath) && fs.existsSync(envExamplePath)) {
  console.log('\n🔧 Creating .env.local from template...');
  fs.copyFileSync(envExamplePath, envLocalPath);
  console.log('✅ .env.local created');
  console.log('💡 You can customize environment variables in .env.local');
}

// Verify build setup
console.log('\n🔍 Verifying build setup...');

const requiredFiles = [
  'vite.config.js',
  'package.json',
  'tsconfig.json',
  'postcss.config.js',
  'src/scripts/main.js',
  'src/styles/main.scss'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing!`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.error('\n❌ Some required files are missing. Please check the setup.');
  process.exit(1);
}

// Check if src directory structure is correct
const srcDirs = ['src/styles', 'src/scripts', 'src/assets'];
for (const dir of srcDirs) {
  if (!fs.existsSync(dir)) {
    console.log(`📁 Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

console.log('\n🎉 Frontend build process setup complete!');
console.log('\n📋 Next steps:');
console.log('   1. Start the backend: python unified_server.py');
console.log('   2. Start the frontend dev server: npm run dev');
console.log('   3. Open http://localhost:3000 in your browser');
console.log('\n📚 For more information, see FRONTEND_BUILD_README.md');
