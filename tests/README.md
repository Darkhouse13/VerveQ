# VerveQ Platform Test Suite Documentation

## Overview

This document provides comprehensive guidance for running, maintaining, and extending the VerveQ Platform test suite. The test infrastructure covers backend (FastAPI), frontend (React Native), and end-to-end testing with a target of 85%+ coverage for critical components.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Coverage Reports](#coverage-reports)
5. [Writing New Tests](#writing-new-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Debugging Test Failures](#debugging-test-failures)
8. [Best Practices](#best-practices)

## Quick Start

### Backend Tests

```bash
# Install dependencies
cd backend
pip install -r requirements-dev.txt

# Run all backend tests
pytest ../tests/backend/

# Run with coverage
pytest ../tests/backend/ --cov=. --cov-report=html

# Run specific test file
pytest ../tests/backend/unit/test_elo_system.py

# Run tests in watch mode
pytest-watch ../tests/backend/
```

### Frontend Tests

```bash
# Install dependencies
cd frontend
npm install

# Run all frontend tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test AuthContext.test.js
```

## Test Structure

```
tests/
├── conftest.py              # Global pytest configuration
├── jest.config.js           # Jest configuration
├── fixtures/                # Shared test data
├── backend/
│   ├── unit/               # Unit tests for services and models
│   │   ├── test_elo_system.py
│   │   ├── test_models.py
│   │   └── test_auth_service.py
│   ├── integration/        # API endpoint tests
│   │   ├── test_auth_routes.py
│   │   └── test_game_routes.py
│   └── utils/              # Test utilities
│       ├── database.py
│       ├── test_client.py
│       └── factories.py
├── frontend/
│   ├── setup.js            # Jest setup with mocks
│   ├── context/            # Context provider tests
│   │   └── AuthContext.test.js
│   └── screens/            # Screen component tests
└── e2e/                    # End-to-end tests
```

## Running Tests

### Backend Tests by Category

```bash
# Run only unit tests
pytest ../tests/backend/unit/ -v

# Run only integration tests
pytest ../tests/backend/integration/ -v

# Run tests with specific markers
pytest -m "unit" -v
pytest -m "integration" -v
pytest -m "slow" -v

# Run tests in parallel (requires pytest-xdist)
pip install pytest-xdist
pytest -n auto
```

### Frontend Tests by Category

```bash
# Run only context tests
npm test -- context/

# Run only screen tests
npm test -- screens/

# Run tests with pattern matching
npm test -- --testNamePattern="login"
npm test -- --testPathPattern="Auth"
```

### Database Testing

Tests use SQLite in-memory database by default for speed. To test with PostgreSQL:

```bash
# Set test database URL
export DATABASE_URL=postgresql://user:pass@localhost/verveq_test

# Run tests
pytest ../tests/backend/
```

## Coverage Reports

### Backend Coverage

```bash
# Generate coverage report
pytest ../tests/backend/ --cov=backend --cov-report=html

# View HTML report
open htmlcov/index.html

# Coverage thresholds (configured in pytest.ini):
# - Overall: 85%
# - ELO System: 95%
# - Authentication: 95%
# - API Routes: 90%
```

### Frontend Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# Coverage thresholds (configured in jest.config.js):
# - Statements: 75%
# - Branches: 70%
# - Functions: 75%
# - Lines: 75%
```

### Coverage by Component

| Component | Target | Current | Status |
|-----------|--------|---------|--------|
| ELO System | 95% | - | ✅ |
| Auth Service | 95% | - | ✅ |
| API Routes | 90% | - | ✅ |
| Database Models | 80% | - | ✅ |
| AuthContext | 90% | - | ✅ |
| Frontend Screens | 80% | - | 🚧 |

## Writing New Tests

### Backend Test Template

```python
"""Test module description."""
import pytest
from tests.backend.utils.factories import UserFactory

class TestNewFeature:
    """Test cases for new feature."""
    
    @pytest.fixture
    def setup_data(self, db_session):
        """Setup test data."""
        user = UserFactory()
        db_session.add(user)
        return user
    
    @pytest.mark.asyncio
    async def test_feature_success(self, client, setup_data):
        """Test successful scenario."""
        response = await client.post("/api/v1/feature")
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_feature_error(self, client):
        """Test error scenario."""
        response = await client.post("/api/v1/feature", json={})
        assert response.status_code == 400
```

### Frontend Test Template

```javascript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ComponentName } from '../../../frontend/src/components/ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    const { getByText } = render(<ComponentName />);
    expect(getByText('Expected Text')).toBeTruthy();
  });
  
  it('should handle user interaction', async () => {
    const mockHandler = jest.fn();
    const { getByTestId } = render(
      <ComponentName onPress={mockHandler} />
    );
    
    fireEvent.press(getByTestId('button'));
    await waitFor(() => {
      expect(mockHandler).toHaveBeenCalled();
    });
  });
});
```

### Using Test Factories

```python
from tests.backend.utils.factories import (
    UserFactory, UserRatingFactory, GameSessionFactory
)

# Create test user with custom attributes
user = UserFactory(username="testplayer", email="test@example.com")

# Create user with ratings
user, ratings = create_user_with_ratings(
    username="pro_player",
    sports=["football", "tennis"]
)

# Create completed game session
user, session = create_game_session_with_user(
    score=90,
    mode="quiz",
    sport="football"
)
```

## CI/CD Integration

### GitHub Actions Workflow

The CI/CD pipeline runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

#### Pipeline Stages

1. **Backend Tests** - Runs on Python 3.9, 3.10, 3.11
2. **Frontend Tests** - Runs on Node.js 18.x, 20.x
3. **Code Quality** - Black, isort, mypy checks
4. **Security Scan** - Trivy vulnerability scanning
5. **E2E Tests** - Full integration testing

### Running CI Locally

```bash
# Install act (GitHub Actions local runner)
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | bash

# Run workflow locally
act -j backend-tests
act -j frontend-tests
```

## Debugging Test Failures

### Common Backend Issues

1. **Database Connection Errors**
   ```python
   # Ensure test database is properly initialized
   async with test_db() as db:
       await db.create_all()
   ```

2. **Async Test Failures**
   ```python
   # Always use pytest.mark.asyncio
   @pytest.mark.asyncio
   async def test_async_function():
       result = await async_function()
   ```

3. **JWT Token Issues**
   ```python
   # Use test JWT secret
   os.environ["JWT_SECRET_KEY"] = "test-secret"
   ```

### Common Frontend Issues

1. **Navigation Mock Errors**
   ```javascript
   // Ensure navigation is mocked
   const mockNavigate = jest.fn();
   jest.mock('@react-navigation/native', () => ({
     useNavigation: () => ({ navigate: mockNavigate })
   }));
   ```

2. **AsyncStorage Errors**
   ```javascript
   // Clear AsyncStorage between tests
   beforeEach(() => {
     AsyncStorage.clear();
   });
   ```

3. **API Call Failures**
   ```javascript
   // Mock fetch properly
   global.fetch = jest.fn(() =>
     Promise.resolve({
       ok: true,
       json: () => Promise.resolve(mockData)
     })
   );
   ```

### Debugging Tips

1. **Increase Test Verbosity**
   ```bash
   pytest -vvs  # Very verbose with stdout
   npm test -- --verbose
   ```

2. **Run Single Test**
   ```bash
   pytest -k "test_specific_function"
   npm test -- -t "should handle login"
   ```

3. **Debug Mode**
   ```bash
   pytest --pdb  # Drop into debugger on failure
   node --inspect-brk node_modules/.bin/jest --runInBand
   ```

## Best Practices

### Test Organization

1. **Group related tests** in classes (Python) or describe blocks (JavaScript)
2. **Use descriptive test names** that explain what is being tested
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **One assertion per test** when possible

### Test Data

1. **Use factories** for consistent test data generation
2. **Avoid hardcoded values** - use constants or fixtures
3. **Clean up test data** after each test
4. **Use realistic data** that matches production scenarios

### Performance

1. **Use in-memory database** for unit tests
2. **Mock external services** (APIs, file systems)
3. **Run independent tests in parallel**
4. **Minimize database transactions** in tests

### Maintenance

1. **Update tests when code changes**
2. **Remove obsolete tests**
3. **Refactor duplicate test code**
4. **Document complex test scenarios**

## Test Metrics

### Current Status

- **Total Tests**: 150+
- **Backend Tests**: 80+
- **Frontend Tests**: 40+
- **E2E Tests**: 10+
- **Average Execution Time**: < 2 minutes

### Performance Benchmarks

| Test Type | Target Time | Current Time |
|-----------|-------------|--------------|
| Unit Tests | < 10s | - |
| Integration Tests | < 30s | - |
| E2E Tests | < 2m | - |
| Full Suite | < 5m | - |

## Troubleshooting

### FAQ

**Q: Tests pass locally but fail in CI?**
A: Check environment variables, database setup, and timezone differences.

**Q: How to skip slow tests during development?**
A: Use `pytest -m "not slow"` or `npm test -- --testTimeout=5000`

**Q: How to update test snapshots?**
A: Run `npm test -- --updateSnapshot`

**Q: How to generate missing `__init__.py` files?**
A: Run `find tests -type d -exec touch {}/__init__.py \;`

### Getting Help

1. Check test output for detailed error messages
2. Review similar tests for examples
3. Consult the specific test file's docstring
4. Check CI logs for environment-specific issues

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure tests cover happy path and edge cases
3. Maintain or improve coverage percentages
4. Update this documentation if needed

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)