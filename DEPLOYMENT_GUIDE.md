# VerveQ Multi-Sport Platform - Production Deployment Guide

## 🚀 DigitalOcean App Platform Deployment

### Prerequisites

1. **DigitalOcean Account** with App Platform access
2. **PostgreSQL Database** (already configured and working)
3. **GitHub Repository** with clean production code
4. **Domain name** (optional but recommended)

---

## 📋 Pre-Deployment Checklist

### ✅ Code Preparation
- [x] Frontend API calls updated to multi-sport structure
- [x] Development/test files removed
- [x] .gitignore updated for production
- [x] Production requirements.txt created
- [x] Environment variables documented

### ✅ Database Status
- [x] PostgreSQL working on DigitalOcean
- [x] Database populated with sports and competitions
- [x] Connection string secured

### ✅ Configuration Files
- [x] Production environment template created
- [x] Frontend build system optimized
- [x] Security settings configured

---

## 🔧 Step-by-Step Deployment

### 1. **Prepare GitHub Repository**

```bash
# Commit all production changes
git add .
git commit -m "feat: prepare for production deployment

- Fix frontend API calls to use multi-sport structure
- Remove development/test files for clean production build
- Add production requirements and environment templates
- Update .gitignore for deployment readiness
- Optimize build system for DigitalOcean App Platform

🚀 Ready for DigitalOcean deployment"

# Push to main branch
git push origin main
```

### 2. **DigitalOcean App Platform Setup**

1. **Create New App**:
   - Go to DigitalOcean → Apps → Create App
   - Connect your GitHub repository
   - Select the main branch

2. **Configure Build Settings**:
   ```yaml
   # App Spec Configuration
   name: verveq-multi-sport
   region: fra
   
   services:
   - name: web
     source_dir: /
     github:
       repo: your-username/your-repo-name
       branch: main
     run_command: uvicorn multi_sport_web_server:app --host 0.0.0.0 --port $PORT
     environment_slug: python
     instance_count: 1
     instance_size_slug: basic-xxs
     
     build_command: |
       pip install -r requirements-prod.txt
       npm install
       npm run deploy:build
   ```

3. **Environment Variables**:
   Set these in App Platform → Settings → Environment Variables:
   ```
   SECRET_KEY=your-production-secret-key
   DATABASE_URL=postgresql://your-db-connection-string
   ENABLE_POSTGRESQL=true
   FALLBACK_TO_JSON=false
   VERVEQ_SERVER_MODE=full
   VERVEQ_ENABLE_MULTI_SPORT=true
   VERVEQ_LOG_LEVEL=INFO
   PORT=8008
   ```

### 3. **Database Configuration**

Ensure your existing PostgreSQL database is accessible:
- **Host**: Your DigitalOcean PostgreSQL cluster
- **SSL**: Required (`?sslmode=require`)
- **Connection Pooling**: Configured in requirements-prod.txt

### 4. **Domain Setup** (Optional)

1. Add custom domain in App Platform
2. Configure DNS settings
3. SSL certificate (automatic with DigitalOcean)

### 5. **Static Files Configuration**

The app will serve static files from:
- `/static/` - CSS, JavaScript, images
- `/` - HTML files (multi_sport_index.html, enhanced_quiz.html, etc.)

---

## 🔍 Verification Steps

### 1. **Health Check**
```bash
curl https://your-app-url.ondigitalocean.app/health
```
Expected response:
```json
{
  "status": "healthy",
  "components": {
    "data_handler": {
      "type": "postgresql",
      "status": "active"
    }
  }
}
```

### 2. **API Endpoints**
```bash
# Test multi-sport API
curl https://your-app-url.ondigitalocean.app/api/sports
curl https://your-app-url.ondigitalocean.app/api/football/competitions
```

### 3. **Frontend**
- Visit `https://your-app-url.ondigitalocean.app/`
- Select a sport (football/tennis)
- Start quiz mode - should work without 404 errors
- Test survival mode

---

## 🛠️ Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check build logs in DigitalOcean dashboard
   - Verify requirements-prod.txt dependencies
   - Ensure Node.js version compatibility

2. **Database Connection**:
   - Verify DATABASE_URL format
   - Check firewall/IP whitelisting
   - Test connection from App Platform

3. **Frontend 404s**:
   - Verify static file serving configuration
   - Check app spec routing settings

4. **Performance Issues**:
   - Monitor resource usage
   - Consider upgrading instance size
   - Enable Redis caching

### Debug Commands
```bash
# Check app status
doctl apps list

# View logs
doctl apps logs <app-id>

# Get app spec
doctl apps spec get <app-id>
```

---

## 📊 Production Monitoring

### Key Metrics to Monitor
- Response time
- Error rates
- Database connection pool
- Memory usage
- PostgreSQL performance

### Recommended Tools
- DigitalOcean Monitoring
- App Platform built-in metrics
- PostgreSQL performance insights

---

## 🔐 Security Considerations

1. **Environment Variables**: Never commit production secrets
2. **Database Access**: Use strong passwords and SSL
3. **API Rate Limiting**: Enabled by default
4. **CORS**: Configured for production domains
5. **HTTPS**: Enforced by DigitalOcean App Platform

---

## 📈 Scaling Considerations

### Vertical Scaling
- Upgrade instance size for more CPU/memory
- Monitor performance metrics

### Horizontal Scaling
- Increase instance count in app spec
- Database connection pooling handles multiple instances

### Database Scaling
- Monitor PostgreSQL performance
- Consider read replicas for high traffic
- Optimize queries and indexing

---

## 🎯 Post-Deployment Tasks

1. **DNS Configuration**: Point domain to DigitalOcean app
2. **Monitoring Setup**: Configure alerts
3. **Backup Strategy**: Database backup schedule
4. **Performance Testing**: Load testing with expected traffic
5. **Documentation**: Update README with production URLs

---

## 📞 Support

For deployment issues:
1. Check DigitalOcean App Platform documentation
2. Review application logs
3. Verify environment configuration
4. Test database connectivity

**Deployment Status**: ✅ Ready for Production