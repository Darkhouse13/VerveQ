# Redis Installation Guide for Windows

## Option 1: Using Windows Subsystem for Linux (WSL)
1. Install WSL2 if not already installed
2. Install Ubuntu or your preferred Linux distribution
3. In WSL terminal:
   ```bash
   sudo apt update
   sudo apt install redis-server
   sudo service redis-server start
   ```

## Option 2: Using Docker
1. Install Docker Desktop for Windows
2. Run Redis container:
   ```bash
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

## Option 3: Using Windows Native Redis
1. Download Redis for Windows from: https://github.com/tporadowski/redis/releases
2. Install and start the Redis service

## Verify Redis is running
Test with: `redis-cli ping`
Should return: `PONG`

## Alternative: Use Memory Cache for Development
If you prefer not to install Redis, we can modify the cache to use in-memory storage for development.
