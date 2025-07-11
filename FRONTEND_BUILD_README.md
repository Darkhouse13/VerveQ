# VerveQ Frontend Build Process

This document describes the modern frontend build process implemented for the FootQuizz application using Vite.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Python 3.8+ (for the backend)

### Development Setup

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   # Terminal 1: Start the backend
   python unified_server.py

   # Terminal 2: Start the frontend dev server
   npm run dev
   ```

3. **Access the application:**
   - Frontend dev server: http://localhost:3000
   - Backend API: http://localhost:8008
   - The frontend dev server proxies API requests to the backend

### Production Build

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Preview the production build:**
   ```bash
   npm run preview
   ```

3. **Start the backend (serves built assets):**
   ```bash
   python unified_server.py
   ```

## 📁 Project Structure

```
FootQuizz/
├── src/                          # Vite source directory
│   ├── styles/                   # SCSS stylesheets
│   │   ├── main.scss            # Main stylesheet entry
│   │   ├── variables.scss       # SCSS variables
│   │   ├── dark_football_theme.css
│   │   ├── enhanced_styles.css
│   │   └── multi_sport_theme.css
│   ├── scripts/                  # JavaScript files
│   │   ├── main.js              # Main JS entry point
│   │   └── accessibility.js     # Accessibility features
│   ├── assets/                   # Static assets
│   │   ├── images/
│   │   └── fonts/
│   └── *.html                    # HTML templates
├── public/                       # Public static assets
├── dist/                         # Production build output
├── static/                       # Legacy static files (fallback)
├── package.json                  # Node.js dependencies
├── vite.config.js               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── postcss.config.js            # PostCSS configuration
└── .env.example                 # Environment variables template
```

## 🛠️ Build Features

### Development Features
- **Hot Module Replacement (HMR)** - Instant updates during development
- **Source Maps** - Full debugging support
- **CSS Preprocessing** - SCSS support with variables
- **API Proxy** - Seamless backend communication
- **Live Reloading** - Automatic browser refresh

### Production Optimizations
- **Code Splitting** - Automatic chunk splitting for better caching
- **Asset Minification** - CSS and JavaScript minification
- **Cache Busting** - Automatic file hashing for cache invalidation
- **Legacy Browser Support** - Polyfills for older browsers
- **Bundle Analysis** - Size analysis with `npm run build:analyze`

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env.local` and customize:

```bash
# Development server
VITE_DEV_PORT=3000
VITE_API_BASE_URL=http://localhost:8008

# Feature flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG_MODE=false
```

### Vite Configuration
The `vite.config.js` file includes:
- Multi-page application setup
- Asset optimization
- Development server proxy
- Build output customization

## 📦 Dependencies

### Production Dependencies
- None (all frontend code is bundled)

### Development Dependencies
- **vite** - Build tool and dev server
- **sass** - CSS preprocessing
- **autoprefixer** - CSS vendor prefixing
- **@vitejs/plugin-legacy** - Legacy browser support
- **typescript** - Type checking support
- **rollup-plugin-visualizer** - Bundle analysis

## 🔄 Integration with Backend

### Development Mode
- Frontend runs on port 3000
- Backend runs on port 8008
- Vite dev server proxies API requests to backend
- Hot reloading for frontend changes

### Production Mode
- Backend serves built assets from `dist/` directory
- Optimized caching headers for static assets
- Single server deployment

## 📋 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run type-check       # Run TypeScript type checking

# Production
npm run build            # Build for production
npm run preview          # Preview production build
npm run build:analyze    # Build with bundle analysis

# Maintenance
npm run clean            # Clean build directory
```

## 🚀 Deployment

### Single Server Deployment
1. Build the frontend: `npm run build`
2. Start the backend: `python unified_server.py`
3. Backend automatically serves built assets

### Separate Deployment
1. Build the frontend: `npm run build`
2. Deploy `dist/` contents to CDN/static hosting
3. Update backend CORS settings for production domain

## 🔍 Troubleshooting

### Common Issues

**Build fails with dependency errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Assets not loading in production:**
- Check that `dist/` directory exists
- Verify backend is serving from correct directory
- Check browser console for 404 errors

**Development server not proxying API:**
- Verify backend is running on port 8008
- Check proxy configuration in `vite.config.js`
- Ensure API endpoints start with `/api`

### Performance Monitoring
- Use `npm run build:analyze` to analyze bundle size
- Check browser DevTools Network tab for asset loading
- Monitor Core Web Vitals in production

## 🔄 Migration from Legacy

The build process maintains backward compatibility:
- Legacy static files in `static/` directory are preserved
- Backend automatically detects and serves Vite build when available
- Fallback to legacy files when `dist/` doesn't exist
- No changes required to existing Python code
