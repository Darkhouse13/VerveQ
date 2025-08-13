# Deployment Guide

This guide provides instructions for deploying the VerveQ Platform in a production environment.

## Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL 12+ (recommended for production)
- Domain name and SSL certificate

## Production Environment Setup

### Backend Deployment

1. **Install Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

2. **Configure Environment Variables**
Create a `.env` file with the following variables:
```bash
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
JWT_SECRET_KEY=your-secure-secret-key
CORS_ORIGINS=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

3. **Generate Secure JWT Key**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

4. **Run Database Migrations**
```bash
# If using database migration scripts
python database/migration_001_time_based_scoring.py
```

5. **Start the Application**
```bash
python run.py
```

### Frontend Deployment

1. **Install Dependencies**
```bash
cd frontend
npm install
```

2. **Configure Environment**
Update `frontend/src/config/api.js` to point to your production API URL.

3. **Build for Production**
```bash
npm run build
```

4. **Deploy**
Deploy the built files to your web server or hosting platform.

## Database Configuration

### PostgreSQL Setup

1. **Install PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
```

2. **Create Database and User**
```sql
CREATE DATABASE verveq_prod;
CREATE USER verveq_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE verveq_prod TO verveq_user;
```

3. **Update Connection String**
In your `.env` file:
```bash
DATABASE_URL=postgresql://verveq_user:secure_password@localhost:5432/verveq_prod
```

## Security Configuration

### SSL/TLS
Ensure your deployment uses HTTPS with a valid SSL certificate.

### CORS Configuration
Set specific domains in your CORS configuration:
```bash
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Rate Limiting
Configure appropriate rate limits for your production environment:
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

## Monitoring and Maintenance

### Logging
Configure centralized logging for production:
```bash
LOG_LEVEL=INFO
```

### Backups
Implement regular database backups:
```bash
# Example backup script
pg_dump -U verveq_user verveq_prod > backup_$(date +%Y%m%d).sql
```

### Updates
Regularly update dependencies and apply security patches.

## Scaling Considerations

### Load Balancing
For high-traffic deployments, consider using a load balancer.

### Caching
Implement Redis caching for improved performance.

### Database Optimization
Monitor database performance and optimize queries as needed.

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify database URL format
   - Check database credentials
   - Ensure database server is running

2. **CORS Errors**
   - Verify CORS origins are correctly configured
   - Check that frontend URL matches CORS settings

3. **Authentication Issues**
   - Verify JWT secret key is properly configured
   - Check token expiration settings

### Support
For deployment issues, please create an issue on GitHub or contact the maintainers.