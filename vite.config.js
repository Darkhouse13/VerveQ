import { defineConfig } from 'vite'
import { resolve } from 'path'
import legacy from '@vitejs/plugin-legacy'
import { createHtmlPlugin } from 'vite-plugin-html'
import { visualizer } from 'rollup-plugin-visualizer'
import autoprefixer from 'autoprefixer'

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'
  const isProd = command === 'build'
  const isAnalyze = mode === 'analyze'

  return {
    // Root directory for source files
    root: 'src',
    
    // Public directory for static assets
    publicDir: '../public',
    
    // Build configuration
    build: {
      // Output directory relative to project root
      outDir: '../dist',
      
      // Empty output directory before build
      emptyOutDir: true,
      
      // Generate source maps for production
      sourcemap: isProd ? 'hidden' : true,
      
      // Asset file naming
      assetsDir: 'assets',
      
      // Rollup options
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/index.html'),
          leaderboard: resolve(__dirname, 'src/leaderboard.html'),
          survival: resolve(__dirname, 'src/survival.html'),
          'multi-sport': resolve(__dirname, 'src/multi_sport_index.html'),
          admin: resolve(__dirname, 'src/admin_dashboard.html'),
          analytics: resolve(__dirname, 'src/analytics_dashboard.html')
        },
        output: {
          // Chunk file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.')
            const ext = info[info.length - 1]
            if (/\.(css)$/.test(assetInfo.name)) {
              return `assets/css/[name]-[hash].${ext}`
            }
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
              return `assets/images/[name]-[hash].${ext}`
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
              return `assets/fonts/[name]-[hash].${ext}`
            }
            return `assets/[name]-[hash].${ext}`
          }
        }
      },
      
      // Minification
      minify: isProd ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd
        }
      },
      
      // Code splitting
      chunkSizeWarningLimit: 1000
    },
    
    // Development server configuration
    server: {
      port: 3000,
      host: true,
      open: false,
      cors: true,
      
      // Proxy API requests to FastAPI backend
      proxy: {
        '/api': {
          target: 'http://localhost:8008',
          changeOrigin: true,
          secure: false
        },
        '/admin': {
          target: 'http://localhost:8008',
          changeOrigin: true,
          secure: false
        }
      }
    },
    
    // Preview server configuration
    preview: {
      port: 3001,
      host: true,
      open: false
    },
    
    // CSS configuration
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "./src/styles/variables.scss";`
        }
      },
      postcss: {
        plugins: [
          autoprefixer
        ]
      }
    },
    
    // Plugins
    plugins: [
      // HTML processing
      createHtmlPlugin({
        minify: isProd,
        inject: {
          data: {
            title: 'VerveQ - Ultimate Football Knowledge Challenge',
            description: 'Test your football knowledge with our ultimate quiz featuring questions about players, teams, and football history.'
          }
        }
      }),
      
      // Legacy browser support
      legacy({
        targets: ['defaults', 'not IE 11'],
        renderLegacyChunks: isProd,
        polyfills: isProd,
        modernPolyfills: false,
        // Disable the console.warn in production
        renderModernChunks: true,
        externalSystemJS: false
      }),
      
      // Bundle analyzer (only in analyze mode)
      ...(isAnalyze ? [
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true
        })
      ] : [])
    ],
    
    // Dependency optimization
    optimizeDeps: {
      include: []
    },
    
    // Define global constants
    define: {
      __DEV__: isDev,
      __PROD__: isProd
    }
  }
})
