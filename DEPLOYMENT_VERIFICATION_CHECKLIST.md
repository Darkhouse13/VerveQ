# 🚀 FootQuizz Deployment Verification Checklist

## 📋 Pre-Deployment Checklist

### 1. **Environment Configuration**
- [ ] Set `VERVEQ_ENABLE_MULTI_SPORT=true` environment variable
- [ ] Set `VERVEQ_SERVER_MODE=full` for complete feature set
- [ ] Verify `SECRET_KEY` is set for production (optional for development)
- [ ] Check database connection string if using PostgreSQL

### 2. **Data Verification**
- [ ] Confirm tennis data files exist in `processed_tennis/`:
  - [ ] `tennis_awards.json`
  - [ ] `tennis_stats.json` 
  - [ ] `tennis_tournaments.json`
- [ ] Verify football data files exist in `data/` directory
- [ ] Check survival mode data files:
  - [ ] `survival_initials_map.json`
  - [ ] `survival_initials_map_tennis.json`

### 3. **Frontend Build Process**
- [ ] Run `npm install` to ensure dependencies are installed
- [ ] Execute `npm run build` to build latest frontend changes
- [ ] Verify `dist/` directory contains updated files:
  - [ ] `dist/index.html` (main football interface)
  - [ ] `dist/multi_sport_index.html` (multi-sport interface with tennis)
  - [ ] `dist/assets/` directory with CSS and JS files

### 4. **Server Selection**
Choose the appropriate server based on your needs:

**Option A: Unified Server (Recommended)**
```bash
set VERVEQ_ENABLE_MULTI_SPORT=true
set VERVEQ_SERVER_MODE=full
python unified_server.py
```

**Option B: Multi-Sport Server**
```bash
python multi_sport_web_server.py
```

**❌ Avoid: Original Web Server**
- Do NOT use `python web_server.py` - it only supports football

### 5. **Server Startup Verification**
Look for these success indicators in server logs:
- [ ] ✅ Multi-sport factory initialized
- [ ] ✅ Multi-sport feature enabled
- [ ] 🏗️ Using Vite production build
- [ ] ✅ Vite assets mounted
- [ ] ✅ Vite static files mounted
- [ ] Server running on http://127.0.0.1:8008

## 🧪 Post-Deployment Testing

### 1. **API Endpoints Testing**
Test these URLs to verify functionality:

- [ ] **Health Check**: http://127.0.0.1:8008/health
- [ ] **API Documentation**: http://127.0.0.1:8008/docs
- [ ] **Sports API**: http://127.0.0.1:8008/api/sports
  - Should return both "football" and "tennis" in supported_sports
- [ ] **Tennis Configuration**: Verify tennis appears with 🎾 icon

### 2. **Frontend Interface Testing**
- [ ] **Main Interface**: http://127.0.0.1:8008/
  - Should show updated interface (not outdated football-only version)
- [ ] **Multi-Sport Interface**: http://127.0.0.1:8008/multi_sport_index.html
  - Should display sport selection with tennis option
  - Tennis theme should use orange/blue colors
- [ ] **Survival Mode**: http://127.0.0.1:8008/survival.html
- [ ] **Leaderboard**: http://127.0.0.1:8008/leaderboard.html

### 3. **Feature Functionality Testing**
- [ ] **Tennis Quiz Generation**: Test tennis quiz creation through API
- [ ] **Sport Switching**: Verify ability to switch between football and tennis
- [ ] **Tennis Survival Mode**: Test tennis player name matching
- [ ] **Cross-Sport Statistics**: Verify multi-sport ELO system

## 🔧 Troubleshooting Common Issues

### Issue: "Tennis functionality not appearing"
**Root Cause**: Using wrong server or missing environment variables
**Solution**: 
1. Stop current server: `taskkill /F /PID [PID]`
2. Set environment variables: `set VERVEQ_ENABLE_MULTI_SPORT=true`
3. Use unified server: `python unified_server.py`

### Issue: "Outdated interface showing"
**Root Cause**: Frontend not built or server serving wrong files
**Solution**:
1. Run `npm run build`
2. Restart server with Vite build support (unified_server.py)

### Issue: "Tennis data not loading"
**Root Cause**: Missing tennis data files
**Solution**:
1. Run `python tennis_data_processor.py` to process tennis data
2. Verify `processed_tennis/` directory contains JSON files

### Issue: "Server initialization errors"
**Root Cause**: Missing dependencies or database issues
**Solution**:
1. Install dependencies: `pip install -r requirements.txt`
2. Check database configuration
3. Use minimal mode if needed: `set VERVEQ_SERVER_MODE=minimal`

## 📝 Quick Commands Reference

```bash
# Stop any running server
taskkill /F /PID [PID_NUMBER]

# Build frontend
npm run build

# Start with multi-sport enabled
set VERVEQ_ENABLE_MULTI_SPORT=true
set VERVEQ_SERVER_MODE=full
python unified_server.py

# Test API
curl http://127.0.0.1:8008/api/sports
```

## 🎯 Success Criteria

Deployment is successful when:
- [ ] Server starts without errors
- [ ] Multi-sport API returns both football and tennis
- [ ] Multi-sport interface loads with tennis option
- [ ] Tennis quiz generation works
- [ ] No 404 errors on main interfaces
- [ ] Browser shows updated content (not cached old version)

---

**Last Updated**: 2025-07-11
**Version**: 1.0
