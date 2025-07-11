# Complete Guide: Connecting Multi-Sport Web Server to DigitalOcean PostgreSQL

This guide will walk you through connecting your VerveQ multi-sport web server to your DigitalOcean PostgreSQL database cluster.

## 📋 Prerequisites

- ✅ DigitalOcean PostgreSQL database cluster created
- ✅ Multi-sport web server PostgreSQL migration completed
- ✅ Access to your project's root directory

## 🗄️ Step 1: Get Your DigitalOcean Database Connection Details

### 1.1 Access Your Database Dashboard
1. Log into your [DigitalOcean dashboard](https://cloud.digitalocean.com/)
2. Navigate to **"Databases"** in the left sidebar
3. Select your PostgreSQL cluster from the list

### 1.2 Copy Connection Information
In your database dashboard, you'll find:

- **Host**: Something like `db-postgresql-nyc3-12345-do-user-678910-0.b.db.ondigitalocean.com`
- **Port**: Usually `25060` (different from standard PostgreSQL port 5432)
- **Database**: Your database name (e.g., `defaultdb`)
- **Username**: Your database username
- **Password**: Your database password

### 1.3 Example Connection String Format
```
postgresql://username:password@host:port/database
```

**Real Example:**
```
postgresql://doadmin:AVNS_xyz123@db-postgresql-nyc3-12345-do-user-678910-0.b.db.ondigitalocean.com:25060/defaultdb
```

## ⚙️ Step 2: Configure Environment Variables

### 2.1 Create/Update .env File (Recommended Method)

In your project root directory, create or update the `.env` file:

```bash
# Enable PostgreSQL integration
ENABLE_POSTGRESQL=true

# Your DigitalOcean PostgreSQL connection string
DATABASE_URL=postgresql://your_username:your_password@your_host:your_port/your_database

# Enable fallback to JSON files if database is unavailable
FALLBACK_TO_JSON=true

# Optional: Redis for distributed caching (if you have Redis)
# REDIS_URL=redis://localhost:6379

# Optional: Database connection pool settings
# DB_POOL_SIZE=10
# DB_MAX_OVERFLOW=20
# CACHE_TTL=3600
```

### 2.2 Example Complete .env File
```bash
# Database Configuration
ENABLE_POSTGRESQL=true
DATABASE_URL=postgresql://doadmin:AVNS_xyz123@db-postgresql-nyc3-12345-do-user-678910-0.b.db.ondigitalocean.com:25060/defaultdb
FALLBACK_TO_JSON=true

# Server Configuration
SECRET_KEY=your-secret-key-here
VERVEQ_SERVER_MODE=full
VERVEQ_PORT=8008
VERVEQ_DEBUG=false

# Optional Performance Settings
DB_POOL_SIZE=15
DB_MAX_OVERFLOW=25
CACHE_TTL=7200
```

### 2.3 Alternative: System Environment Variables

If you prefer not to use a `.env` file:

**Windows Command Prompt:**
```cmd
set ENABLE_POSTGRESQL=true
set DATABASE_URL=postgresql://username:password@host:port/database
set FALLBACK_TO_JSON=true
```

**Windows PowerShell:**
```powershell
$env:ENABLE_POSTGRESQL="true"
$env:DATABASE_URL="postgresql://username:password@host:port/database"
$env:FALLBACK_TO_JSON="true"
```

**Linux/Mac Terminal:**
```bash
export ENABLE_POSTGRESQL=true
export DATABASE_URL="postgresql://username:password@host:port/database"
export FALLBACK_TO_JSON=true
```

**Permanent Linux/Mac Setup (.bashrc or .zshrc):**
```bash
echo 'export ENABLE_POSTGRESQL=true' >> ~/.bashrc
echo 'export DATABASE_URL="postgresql://username:password@host:port/database"' >> ~/.bashrc
echo 'export FALLBACK_TO_JSON=true' >> ~/.bashrc
source ~/.bashrc
```

## 🧪 Step 3: Test Your Connection

### 3.1 Test the Data Handler
Create a test script to verify your connection:

```python
# test_connection.py
from data_handler_factory import DataHandlerFactory
from config import get_config

# Load configuration
config = get_config()
print("Database Configuration:")
print(f"  PostgreSQL Enabled: {config.database.enable_postgresql}")
print(f"  Database URL: {config.database.database_url}")
print(f"  Fallback to JSON: {config.database.fallback_to_json}")

# Test data handler creation
print("\nTesting data handler creation...")
data_handler = DataHandlerFactory.create_data_handler(config.database, 'data')
handler_info = DataHandlerFactory.get_handler_info(data_handler)
print(f"Data Handler: {handler_info}")

if handler_info['type'] == 'postgresql':
    print("✅ Successfully connected to PostgreSQL!")
elif handler_info['type'] == 'json':
    print("⚠️  Using JSON fallback - check PostgreSQL connection")
else:
    print("❌ No data handler available - check configuration")
```

Run the test:
```bash
python3 test_connection.py
```

### 3.2 Expected Output for Successful Connection
```
Database Configuration:
  PostgreSQL Enabled: True
  Database URL: postgresql://doadmin:AVNS_xyz123@...
  Fallback to JSON: True

Testing data handler creation...
✅ PostgreSQL data handler initialized successfully
🔗 Database URL: postgresql://doadmin:AVNS_xyz123@...
Data Handler: {'type': 'postgresql', 'status': 'active', 'database_url': 'postgresql://doadmin:AVNS_xyz123@...', 'caching_enabled': True}
✅ Successfully connected to PostgreSQL!
```

## 🚀 Step 4: Start Your Multi-Sport Web Server

### 4.1 Start the Server
```bash
python3 multi_sport_web_server.py
```

### 4.2 Expected Startup Output
```
🔄 Initializing data handler...
✅ Data handler initialized: postgresql (active)
🚀 Starting VerveQ Multi-Sport FastAPI Server...
============================================================
✅ Multi-sport server initialization successful!

📊 Available Sports:
   ✅ Football
   ✅ Tennis

🌐 Server starting at: http://127.0.0.1:8008
🔍 Health check: http://127.0.0.1:8008/health
📚 API docs: http://127.0.0.1:8008/docs
```

## ✅ Step 5: Verify Everything is Working

### 5.1 Check Health Endpoint
Visit: `http://localhost:8008/health`

Expected response:
```json
{
  "status": "healthy",
  "message": "VerveQ Multi-Sport API is running",
  "supported_sports": ["football", "tennis"],
  "sport_status": {
    "football": true,
    "tennis": true
  },
  "components": {
    "analytics": true,
    "elo_system": true,
    "match_manager": true,
    "data_handler": {
      "type": "postgresql",
      "status": "active",
      "database_url": "postgresql://doadmin:AVNS_xyz123@...",
      "caching_enabled": true
    }
  }
}
```

### 5.2 Test API Endpoints
```bash
# Get supported sports
curl http://localhost:8008/api/sports

# Get football competitions
curl http://localhost:8008/api/football/competitions

# Get tennis competitions  
curl http://localhost:8008/api/tennis/competitions

# Generate a football quiz
curl "http://localhost:8008/api/football/quiz?difficulty=casual&num_questions=5"
```

## 🛠️ Troubleshooting

### Connection Issues

**Problem: "Failed to connect to database"**
```
Solution:
1. Verify your DATABASE_URL is correct
2. Check if your DigitalOcean database is running
3. Ensure your IP is whitelisted in DigitalOcean firewall
4. Test connection with psql: psql "postgresql://username:password@host:port/database"
```

**Problem: "Server falls back to JSON"**
```
Solution:
1. Check ENABLE_POSTGRESQL=true in .env
2. Verify DATABASE_URL format
3. Check database connectivity
4. Review server startup logs for detailed error messages
```

**Problem: "No competitions found"**
```
Solution:
1. Ensure your PostgreSQL database has been migrated with data
2. Run the migration scripts if not done yet
3. Check if tables exist: \dt in psql
4. Verify data exists: SELECT COUNT(*) FROM competitions;
```

### Environment Variable Issues

**Problem: "Environment variables not loading"**
```
Solution:
1. Ensure .env file is in project root directory
2. Check .env file has no BOM or special characters
3. Restart your terminal/IDE
4. Verify python-dotenv is installed: pip install python-dotenv
```

### Performance Issues

**Problem: "Slow API responses"**
```
Solution:
1. Increase cache TTL: CACHE_TTL=7200
2. Adjust connection pool: DB_POOL_SIZE=20
3. Enable Redis caching with REDIS_URL
4. Monitor database performance in DigitalOcean dashboard
```

## 🔒 Security Best Practices

### 1. Protect Your Credentials
- ✅ Never commit `.env` to git
- ✅ Add `.env` to your `.gitignore`
- ✅ Use strong passwords
- ✅ Rotate credentials regularly

### 2. Network Security
- ✅ Configure DigitalOcean firewall rules
- ✅ Use SSL/TLS connections (sslmode=require)
- ✅ Limit database access to necessary IPs only

### 3. Connection Security
```bash
# Enhanced security DATABASE_URL with SSL
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
```

## 📊 Monitoring and Maintenance

### 1. Monitor Connection Health
- Check `/health` endpoint regularly
- Monitor DigitalOcean database metrics
- Set up alerting for connection failures

### 2. Database Maintenance
- Monitor connection pool usage
- Review slow query logs
- Regular database backups (DigitalOcean handles this)

### 3. Performance Optimization
```bash
# Optimal production settings
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
CACHE_TTL=3600
REDIS_URL=redis://your-redis-server:6379
```

## 🎉 Success! 

Your multi-sport web server is now connected to PostgreSQL and ready for production use! 

### Next Steps:
1. 🔗 Connect your frontend applications
2. 📈 Monitor performance and usage
3. 🔄 Set up automated backups
4. 🚀 Deploy to production environment

### Support:
- Check the server logs for detailed information
- Use the `/health` endpoint to monitor status
- Review the API documentation at `/docs`