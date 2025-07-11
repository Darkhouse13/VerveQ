# FootQuizz PostgreSQL Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the PostgreSQL migration for FootQuizz, including database setup, data migration, and application configuration.

## Prerequisites

- PostgreSQL 15+ installed and running
- Python 3.8+ with required dependencies
- Redis (optional, for distributed caching)
- Backup of existing JSON data files
- Administrative access to the database server

## Phase 1: Database Setup

### 1.1 PostgreSQL Installation

#### Local Development (Windows)
```bash
# Download and install PostgreSQL from https://www.postgresql.org/download/windows/
# Or use Chocolatey
choco install postgresql

# Start PostgreSQL service
net start postgresql-x64-15
```

#### Local Development (macOS)
```bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15
```

#### Local Development (Linux)
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 1.2 Database and User Creation

```sql
-- Connect as postgres superuser
psql -U postgres

-- Create database
CREATE DATABASE footquizz_db;

-- Create user
CREATE USER footquizz_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE footquizz_db TO footquizz_user;

-- Connect to the new database
\c footquizz_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO footquizz_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO footquizz_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO footquizz_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO footquizz_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO footquizz_user;
```

### 1.3 Schema Creation

```bash
# Run the schema creation script
psql -U footquizz_user -d footquizz_db -f postgresql_schema.sql
```

### 1.4 Verify Database Setup

```sql
-- Connect to database
psql -U footquizz_user -d footquizz_db

-- Check tables
\dt

-- Verify initial data
SELECT * FROM sports;
SELECT * FROM competitions;
```

## Phase 2: Environment Configuration

### 2.1 Environment Variables

Create a `.env` file in your project root:

```bash
# Database Configuration
DATABASE_URL=postgresql://footquizz_user:footquizz2024@localhost:5432/footquizz_db

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379/0

# Application Configuration
ENABLE_POSTGRESQL=true
FALLBACK_TO_JSON=false
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
CACHE_TTL=3600

# Migration Configuration
MIGRATION_BATCH_SIZE=1000
MIGRATION_LOG_LEVEL=INFO
```

### 2.2 Update requirements.txt

Add PostgreSQL dependencies to your requirements.txt:

```txt
# Add these lines to requirements.txt
psycopg[binary]==3.2.3
redis==5.0.1
cachetools==5.3.2
alembic==1.13.1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 2.3 Configuration File Setup

Copy and customize the migration configuration:

```bash
cp migration_config.example.json migration_config.json
```

Edit `migration_config.json` with your specific settings:

```json
{
  "database_url": "postgresql://footquizz_user:your_password@localhost:5432/footquizz_db",
  "redis_url": "redis://localhost:6379/0",
  "migration_settings": {
    "batch_size": 1000,
    "enable_validation": true,
    "backup_json_files": true,
    "backup_directory": "./backups",
    "log_level": "INFO",
    "dry_run": false
  }
}
```

## Phase 3: Data Migration

### 3.1 Pre-Migration Backup

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d_%H%M%S)

# Backup JSON files
cp -r data/ backups/$(date +%Y%m%d_%H%M%S)/
cp -r processed_tennis/ backups/$(date +%Y%m%d_%H%M%S)/
cp survival_initials_map*.json backups/$(date +%Y%m%d_%H%M%S)/

# Backup existing SQLite databases
cp *.db backups/$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
```

### 3.2 Dry Run Migration

Test the migration without making changes:

```bash
python json_to_postgresql_migrator.py --config-file migration_config.json --dry-run --verbose
```

Review the output for any errors or warnings.

### 3.3 Execute Migration

Run the actual migration:

```bash
python json_to_postgresql_migrator.py --config-file migration_config.json --verbose
```

Monitor the migration log:

```bash
tail -f migration.log
```

### 3.4 Verify Migration

```sql
-- Connect to database
psql -U footquizz_user -d footquizz_db

-- Check record counts
SELECT 'sports' as table_name, COUNT(*) as count FROM sports
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'player_awards', COUNT(*) FROM player_awards
UNION ALL
SELECT 'player_statistics', COUNT(*) FROM player_statistics
UNION ALL
SELECT 'survival_players', COUNT(*) FROM survival_players;

-- Sample data verification
SELECT p.name, pa.season, at.display_name
FROM players p
JOIN player_awards pa ON p.id = pa.player_id
JOIN award_types at ON pa.award_type_id = at.id
LIMIT 10;
```

## Phase 4: Application Configuration

### 4.1 Update config.py

Add PostgreSQL configuration to your config.py:

```python
# Add to config.py
class DatabaseConfig:
    def __init__(self):
        self.database_url = os.environ.get('DATABASE_URL')
        self.enable_postgresql = os.environ.get('ENABLE_POSTGRESQL', 'false').lower() == 'true'
        self.fallback_to_json = os.environ.get('FALLBACK_TO_JSON', 'true').lower() == 'true'
        self.pool_size = int(os.environ.get('DB_POOL_SIZE', '10'))
        self.max_overflow = int(os.environ.get('DB_MAX_OVERFLOW', '20'))
        self.cache_ttl = int(os.environ.get('CACHE_TTL', '3600'))

# Add to ServerConfig class
def __init__(self):
    # ... existing code ...
    self.database = DatabaseConfig()
```

### 4.2 Update unified_server.py

Modify the data handler initialization:

```python
# In unified_server.py, update initialize_core_dependencies()
def initialize_core_dependencies():
    global data_handler, cached_data_handler, quiz_generator, survival_handler

    try:
        print("🔄 Initializing core data handlers...")

        # Check if PostgreSQL is enabled
        if config.database.enable_postgresql and config.database.database_url:
            from postgresql_data_handler import PostgreSQLDataHandler
            data_handler = PostgreSQLDataHandler(
                database_url=config.database.database_url,
                cache_ttl=config.database.cache_ttl
            )
            print("✅ PostgreSQL data handler initialized")
        elif config.database.fallback_to_json:
            from Data import JSONDataHandler
            data_handler = JSONDataHandler(data_root=config.data_root)
            print("✅ JSON data handler initialized (fallback)")
        else:
            raise ValueError("No data handler configured")

        # Initialize caching if enabled
        if config.enable_caching and not isinstance(data_handler, PostgreSQLDataHandler):
            from Data import CacheManager
            cached_data_handler = CacheManager(data_handler)
            print("✅ Cache manager initialized")
        else:
            cached_data_handler = data_handler

        # ... rest of initialization code ...
```

### 4.3 Update Environment-Specific Configurations

#### Development (.env.development)
```bash
DATABASE_URL=postgresql://footquizz_user:dev_password@localhost:5432/footquizz_dev
ENABLE_POSTGRESQL=true
FALLBACK_TO_JSON=true
DB_POOL_SIZE=5
CACHE_TTL=1800
```

#### Production (.env.production)
```bash
DATABASE_URL=postgresql://footquizz_user:prod_password@prod-db-host:5432/footquizz_prod
ENABLE_POSTGRESQL=true
FALLBACK_TO_JSON=false
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
CACHE_TTL=3600
```

## Phase 5: Testing and Validation

### 5.1 Unit Tests

Run existing tests to ensure compatibility:

```bash
# Run all tests
python -m pytest tests/ -v

# Run specific data handler tests
python -m pytest tests/unit/test_data_handler.py -v
```

### 5.2 Integration Tests

Test the application with PostgreSQL:

```bash
# Start the application
python unified_server.py

# Test endpoints
curl http://localhost:8008/api/competitions
curl http://localhost:8008/api/players
curl http://localhost:8008/api/quiz/generate
```

### 5.3 Performance Testing

Compare performance before and after migration:

```bash
# Test query performance
python -c "
from postgresql_data_handler import PostgreSQLDataHandler
import time

handler = PostgreSQLDataHandler()
start = time.time()
competitions = handler.get_available_competitions()
print(f'Competitions query: {time.time() - start:.3f}s')

start = time.time()
players = handler.get_all_players_across_competitions()
print(f'All players query: {time.time() - start:.3f}s')
"
```

### 5.4 Load Testing

Test concurrent access:

```bash
# Install Apache Bench
sudo apt install apache2-utils  # Linux
brew install httpie            # macOS

# Run load test
ab -n 1000 -c 10 http://localhost:8008/api/competitions
```

## Phase 6: Deployment

### 6.1 Production Database Setup

For production, use a managed PostgreSQL service:

#### AWS RDS
```bash
# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier footquizz-prod \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username footquizz_user \
    --master-user-password your_secure_password \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxxxxxxxx
```

#### Google Cloud SQL
```bash
# Create Cloud SQL instance
gcloud sql instances create footquizz-prod \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1
```

### 6.2 Environment Variables for Production

Set production environment variables:

```bash
# For systemd service
sudo systemctl edit footquizz.service

# Add environment variables
[Service]
Environment=DATABASE_URL=postgresql://user:pass@prod-host:5432/footquizz_prod
Environment=ENABLE_POSTGRESQL=true
Environment=FALLBACK_TO_JSON=false
Environment=DB_POOL_SIZE=20
```

### 6.3 Monitoring and Logging

Set up monitoring for the PostgreSQL migration:

```python
# Add to monitoring.py
def check_database_health():
    """Check PostgreSQL database health"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            return {"status": "healthy", "timestamp": datetime.utcnow()}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e), "timestamp": datetime.utcnow()}
```

## Phase 7: Rollback Procedures

### 7.1 Emergency Rollback

If issues occur, quickly rollback to JSON:

```bash
# Update environment variable
export ENABLE_POSTGRESQL=false
export FALLBACK_TO_JSON=true

# Restart application
sudo systemctl restart footquizz
```

### 7.2 Data Rollback

If data corruption occurs:

```bash
# Restore from backup
cp -r backups/YYYYMMDD_HHMMSS/data/ ./
cp -r backups/YYYYMMDD_HHMMSS/processed_tennis/ ./
cp backups/YYYYMMDD_HHMMSS/survival_initials_map*.json ./

# Restart with JSON handler
export ENABLE_POSTGRESQL=false
sudo systemctl restart footquizz
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql

   # Check port availability
   netstat -an | grep 5432
   ```

2. **Permission Denied**
   ```sql
   -- Grant additional permissions
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO footquizz_user;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO footquizz_user;
   ```

3. **Migration Errors**
   ```bash
   # Check migration logs
   tail -f migration.log

   # Run with verbose logging
   python json_to_postgresql_migrator.py --verbose --dry-run
   ```

4. **Performance Issues**
   ```sql
   -- Check query performance
   EXPLAIN ANALYZE SELECT * FROM players WHERE normalized_name LIKE '%messi%';

   -- Update statistics
   ANALYZE;
   ```

### Monitoring Queries

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Conclusion

This deployment guide provides a comprehensive approach to migrating FootQuizz from JSON to PostgreSQL. Follow each phase carefully, test thoroughly, and maintain backups throughout the process. The migration will significantly improve the application's scalability, performance, and data integrity.