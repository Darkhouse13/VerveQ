/**
 * VerveQ Platform PM2 Ecosystem Configuration
 * Manages all services: Backend API, Frontend, and supporting services
 */

module.exports = {
  apps: [
    // Backend API Service
    {
      name: 'verveq-backend',
      script: 'python3',
      args: ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment configuration
      env: {
        PYTHONPATH: './backend',
        ENVIRONMENT: 'development',
        NODE_ENV: 'development'
      },
      env_production: {
        PYTHONPATH: './backend',
        ENVIRONMENT: 'production',
        NODE_ENV: 'production',
        // Use production env file
        ENV_FILE: '../.env.production'
      },
      env_staging: {
        PYTHONPATH: './backend',
        ENVIRONMENT: 'staging',
        NODE_ENV: 'staging'
      },
      
      // Process management
      watch: false, // Disable in production, enable for development
      ignore_watch: [
        'node_modules',
        '*.log',
        '*.db',
        '*.db-journal',
        '__pycache__',
        'logs'
      ],
      
      // Resource limits
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Logging
      log_type: 'json',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/verveq-backend-out.log',
      error_file: './logs/verveq-backend-error.log',
      combine_logs: true,
      
      // Health monitoring
      health_check_http: {
        path: '/health',
        port: 8000,
        timeout: 10000,
        interval: 30000
      },
      
      // Auto restart configuration
      autorestart: true,
      restart_delay: 4000,
      
      // Advanced options
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Clustering (disabled for single instance, can enable later)
      instances: 1,
      exec_mode: 'fork'
    },

    // Frontend Web Service (for production builds)
    {
      name: 'verveq-frontend-web',
      script: 'serve',
      args: ['-s', 'dist', '-l', '3000'],
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Only run in production (web build)
      env_development: {
        NODE_ENV: 'development',
        // Don't auto-start in development (use expo start instead)
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 3000,
        PM2_SERVE_SPA: true
      },
      
      // Resource limits
      max_memory_restart: '200M',
      min_uptime: '5s',
      max_restarts: 5,
      
      // Logging
      out_file: './logs/verveq-frontend-out.log',
      error_file: './logs/verveq-frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart
      autorestart: true,
      watch: false
    },

    // Development Frontend Service (Expo)
    {
      name: 'verveq-expo-dev',
      script: 'npm',
      args: ['start'],
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        EXPO_DEVTOOLS_LISTEN_ADDRESS: '0.0.0.0'
      },
      
      // Only run in development
      env_production: {
        // Disable in production
        autorestart: false
      },
      
      // Resource limits
      max_memory_restart: '800M',
      min_uptime: '10s',
      max_restarts: 3,
      
      // Logging
      out_file: './logs/verveq-expo-out.log',
      error_file: './logs/verveq-expo-error.log',
      
      // Watch for changes in development
      watch: ['frontend/src', 'frontend/App.js'],
      ignore_watch: [
        'node_modules',
        '*.log',
        '.expo'
      ],
      
      autorestart: true
    },

    // Database Migration Service (runs once then exits)
    {
      name: 'verveq-migrate',
      script: './scripts/run_migrations.py',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      
      env: {
        PYTHONPATH: './backend'
      },
      env_production: {
        PYTHONPATH: './backend',
        ENV_FILE: '.env.production'
      },
      
      // Logging
      out_file: './logs/verveq-migrate-out.log',
      error_file: './logs/verveq-migrate-error.log'
    }
  ],

  // Deployment configuration
  deploy: {
    development: {
      user: process.env.DEPLOY_USER || 'ubuntu',
      host: process.env.DEPLOY_HOST || 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/Darkhouse13/VerveQ.git',
      path: process.env.DEPLOY_PATH || '/var/www/verveq',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development && pm2 save',
      'pre-setup': ''
    },

    staging: {
      user: process.env.DEPLOY_USER || 'ubuntu',
      host: process.env.DEPLOY_HOST_STAGING || 'staging.verveq.com',
      ref: 'origin/develop',
      repo: 'https://github.com/Darkhouse13/VerveQ.git',
      path: '/var/www/verveq-staging',
      'pre-deploy-local': './scripts/pre_deploy_checks.sh',
      'post-deploy': 'npm install && ./scripts/deploy.sh staging && pm2 reload ecosystem.config.js --env staging && pm2 save',
      'pre-setup': 'sudo apt-get install python3 python3-pip nodejs npm postgresql redis-server'
    },

    production: {
      user: process.env.DEPLOY_USER || 'ubuntu',
      host: process.env.DEPLOY_HOST_PROD || 'api.verveq.com',
      ref: 'origin/main',
      repo: 'https://github.com/Darkhouse13/VerveQ.git',
      path: '/var/www/verveq-prod',
      'pre-deploy-local': './scripts/pre_deploy_checks.sh',
      'post-deploy': './scripts/deploy.sh production && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'sudo apt-get install python3 python3-pip nodejs npm postgresql redis-server nginx'
    }
  }
};