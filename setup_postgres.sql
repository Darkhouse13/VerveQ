-- VerveQ Platform PostgreSQL Setup Script
-- Run this script to set up the production database

-- Create database (run as postgres superuser)
CREATE DATABASE verveq_prod;

-- Create user with secure password
CREATE USER verveq_user WITH PASSWORD 'CHANGE_THIS_PASSWORD_IN_PRODUCTION';

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE verveq_prod TO verveq_user;

-- Connect to the database
\c verveq_prod

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO verveq_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO verveq_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO verveq_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO verveq_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO verveq_user;

-- Display connection info
\conninfo

-- Test the connection
SELECT 'PostgreSQL setup completed successfully!' as status;