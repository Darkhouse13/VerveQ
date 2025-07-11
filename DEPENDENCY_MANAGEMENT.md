# VerveQ Dependency Management Guide

## Overview

This document explains the dependency management strategy for the VerveQ project, including version pinning rationale, update procedures, and best practices for maintaining reproducible builds.

## File Structure

### Requirements Files

- **`requirements.txt`** - Production dependencies with exact version pins (`==`)
- **`requirements-dev.txt`** - Development dependencies (includes production deps)
- **`requirements-test.txt`** - Testing dependencies (includes production deps)

### Source Files (pip-tools)

- **`requirements.in`** - High-level production dependencies with minimum versions
- **`requirements-dev.in`** - High-level development dependencies
- **`requirements-test.in`** - High-level testing dependencies

## Version Pinning Strategy

### Production Dependencies (requirements.txt)

All production dependencies are pinned to exact versions (`==`) to ensure:
- **Reproducible builds** across different environments
- **Consistent behavior** in development, staging, and production
- **Predictable deployments** without surprise dependency updates
- **Security** by controlling exactly which versions are used

### Critical Dependencies and Version Rationale

#### Core Framework
- **FastAPI 0.115.14** - Latest stable with security fixes and performance improvements
- **Uvicorn 0.35.0** - ASGI server with HTTP/2 support and improved performance
- **Pydantic 2.11.0** - Data validation with improved performance over v1.x
- **Starlette 0.27.0** - Core ASGI framework, version compatible with FastAPI

#### Machine Learning Stack
- **NumPy 2.2.3** - Latest stable with Python 3.13 support
- **Pandas 2.2.3** - Data manipulation, compatible with NumPy 2.x
- **Scikit-learn 1.6.1** - ML algorithms, latest stable version
- **Sentence-transformers 5.0.0** - NLP embeddings, major version with performance improvements

#### Database
- **SQLAlchemy 2.0.41** - Modern async ORM with improved performance
- **psycopg2-binary 2.9.9** - PostgreSQL adapter, binary distribution for easier installation

#### Production Server
- **Gunicorn 23.0.0** - WSGI server for production deployment

## Python Version Compatibility

- **Target Python Version**: 3.13.1
- **Minimum Python Version**: 3.9 (as specified in tox.ini)
- **Tested Versions**: 3.9, 3.10, 3.11 (via tox configuration)

## Dependency Management Workflow

### Using pip-tools (Recommended)

1. **Install pip-tools**:
   ```bash
   pip install pip-tools
   ```

2. **Edit source files** (`.in` files) to add/remove/update dependencies

3. **Compile requirements**:
   ```bash
   make compile-deps
   # Or manually:
   pip-compile requirements.in
   pip-compile requirements-dev.in
   pip-compile requirements-test.in
   ```

4. **Install dependencies**:
   ```bash
   make install-dev  # For development
   make install-test # For testing
   make install      # Production only
   ```

### Manual Management

If not using pip-tools, edit the `.txt` files directly, but ensure:
- All versions are pinned with `==`
- Dependencies are compatible with each other
- Security vulnerabilities are addressed

## Update Procedures

### Regular Updates (Monthly)

1. **Check for outdated packages**:
   ```bash
   make outdated
   ```

2. **Update source files** with new minimum versions in `.in` files

3. **Compile new requirements**:
   ```bash
   make update-deps
   ```

4. **Test thoroughly** with new versions

5. **Commit changes** after successful testing

### Security Updates (As Needed)

1. **Check for vulnerabilities**:
   ```bash
   make check-deps
   ```

2. **Update affected packages** in source files

3. **Recompile and test immediately**

4. **Deploy security updates** as soon as possible

## Environment Setup

### Development Environment

```bash
# Clone repository
git clone <repository-url>
cd FootQuizz

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install development dependencies
make install-dev

# Or manually:
pip install -r requirements-dev.txt
```

### Production Environment

```bash
# Install only production dependencies
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, uvicorn; print('Dependencies installed successfully')"
```

### Testing Environment

```bash
# Install testing dependencies
make install-test

# Run tests
pytest
```

## Troubleshooting

### Common Issues

1. **Version Conflicts**:
   - Use `pip-compile` to resolve conflicts automatically
   - Check for incompatible version ranges in `.in` files

2. **Missing System Dependencies**:
   - Install system packages for psycopg2: `libpq-dev` (Ubuntu) or `postgresql-devel` (CentOS)
   - For Windows: Use `psycopg2-binary` (already configured)

3. **Python Version Issues**:
   - Ensure Python 3.9+ is installed
   - Some packages may not support Python 3.13 yet - check compatibility

### Debugging Commands

```bash
# Show dependency tree
pip show <package-name>

# Check for conflicts
pip check

# Show installed versions
make freeze

# Verify requirements
pip install -r requirements.txt --dry-run
```

## Best Practices

1. **Always pin production dependencies** to exact versions
2. **Use pip-tools** for easier maintenance
3. **Test dependency updates** in a separate environment first
4. **Keep security updates current** - check monthly
5. **Document version choices** for critical dependencies
6. **Use virtual environments** to isolate dependencies
7. **Commit lock files** (requirements.txt) to version control
8. **Separate concerns** - different requirement files for different purposes

## Security Considerations

- **Regular security scans** using `safety check`
- **Monitor security advisories** for critical dependencies
- **Update vulnerable packages** immediately
- **Use trusted package sources** (PyPI)
- **Verify package integrity** when possible

## Maintenance Schedule

- **Weekly**: Check for security updates
- **Monthly**: Review and update non-critical dependencies
- **Quarterly**: Major dependency version updates and compatibility testing
- **As needed**: Emergency security patches
