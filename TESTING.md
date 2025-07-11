# VerveQ Testing Guide

This document provides comprehensive information about the VerveQ testing framework and how to run tests effectively.

## 🧪 Testing Framework Overview

VerveQ uses **pytest** as its primary testing framework, providing:

- **Organized test structure** with clear separation of unit and integration tests
- **Comprehensive fixtures** for mocking and test data
- **Parameterized tests** for testing multiple configurations
- **CI/CD integration** with GitHub Actions
- **Coverage reporting** with detailed metrics
- **Performance testing** capabilities

## 📁 Test Structure

```
tests/
├── conftest.py                 # Global fixtures and configuration
├── pytest.ini                 # Pytest configuration
├── unit/                       # Unit tests for individual components
│   ├── test_data_handlers.py   # Data loading and caching tests
│   ├── test_quiz_generator.py  # Quiz generation logic tests
│   ├── test_elo_system.py      # ELO rating system tests
│   ├── test_analytics.py       # Analytics functionality tests
│   ├── test_survival_mode.py   # Survival mode tests
│   └── test_multi_sport.py     # Multi-sport functionality tests
├── integration/                # Integration tests
│   ├── test_server_modes.py    # Server mode configuration tests
│   ├── test_api_endpoints.py   # API endpoint integration tests
│   └── test_feature_flags.py   # Feature flag configuration tests
├── fixtures/                   # Test data and fixtures
│   ├── mock_data.py            # Mock data constants
│   └── mock_factories.py       # Mock object factories
└── utils/                      # Test utilities
    └── test_helpers.py         # Helper functions and utilities
```

## 🚀 Quick Start

### Install Testing Dependencies

```bash
# Install test dependencies
pip install -r requirements-test.txt

# Or install specific testing tools
pip install pytest pytest-cov pytest-mock pytest-asyncio
```

### Run All Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=. --cov-report=html --cov-report=term-missing
```

## 🎯 Running Specific Tests

### By Test Category

```bash
# Unit tests only
pytest tests/unit/

# Integration tests only
pytest tests/integration/

# Specific test file
pytest tests/unit/test_quiz_generator.py

# Specific test method
pytest tests/unit/test_quiz_generator.py::TestQuizGenerator::test_generate_basic_quiz
```

### By Test Markers

```bash
# Run only unit tests
pytest -m "unit"

# Run only integration tests
pytest -m "integration"

# Run server mode tests
pytest -m "server_mode"

# Run feature flag tests
pytest -m "feature_flag"

# Run multi-sport tests
pytest -m "multi_sport"

# Run ELO system tests
pytest -m "elo"

# Run survival mode tests
pytest -m "survival"

# Run analytics tests
pytest -m "analytics"

# Exclude slow tests
pytest -m "not slow"

# Run only performance tests
pytest -m "performance"
```

### By Server Mode

```bash
# Test minimal mode
VERVEQ_SERVER_MODE=minimal pytest tests/integration/test_server_modes.py -k "minimal"

# Test standard mode
VERVEQ_SERVER_MODE=standard pytest tests/integration/test_server_modes.py -k "standard"

# Test full mode
VERVEQ_SERVER_MODE=full pytest tests/integration/test_server_modes.py -k "full"
```

## 🔧 Advanced Testing Options

### Parallel Testing

```bash
# Run tests in parallel (faster execution)
pytest -n auto

# Run with specific number of workers
pytest -n 4
```

### Coverage Analysis

```bash
# Generate HTML coverage report
pytest --cov=. --cov-report=html

# Generate XML coverage report (for CI)
pytest --cov=. --cov-report=xml

# Show missing lines in terminal
pytest --cov=. --cov-report=term-missing

# Set minimum coverage threshold
pytest --cov=. --cov-fail-under=80
```

### Test Output and Debugging

```bash
# Verbose output with full tracebacks
pytest -v --tb=long

# Show print statements
pytest -s

# Stop on first failure
pytest -x

# Show local variables in tracebacks
pytest --tb=auto --showlocals

# Run specific test with debugging
pytest tests/unit/test_quiz_generator.py::test_generate_basic_quiz -v -s --tb=long
```

## 🏷️ Test Markers Reference

| Marker | Description | Usage |
|--------|-------------|-------|
| `unit` | Unit tests for individual components | `pytest -m "unit"` |
| `integration` | Integration tests for component interactions | `pytest -m "integration"` |
| `api` | API endpoint tests | `pytest -m "api"` |
| `server_mode` | Tests for different server modes | `pytest -m "server_mode"` |
| `feature_flag` | Tests for feature flag configurations | `pytest -m "feature_flag"` |
| `multi_sport` | Tests for multi-sport functionality | `pytest -m "multi_sport"` |
| `elo` | Tests for ELO rating system | `pytest -m "elo"` |
| `survival` | Tests for survival mode | `pytest -m "survival"` |
| `analytics` | Tests for analytics functionality | `pytest -m "analytics"` |
| `cache` | Tests for caching functionality | `pytest -m "cache"` |
| `slow` | Tests that take longer to run | `pytest -m "slow"` |
| `performance` | Performance and load tests | `pytest -m "performance"` |
| `requires_data` | Tests that require data files | `pytest -m "requires_data"` |
| `requires_db` | Tests that require database setup | `pytest -m "requires_db"` |

## 🔄 Continuous Integration

### GitHub Actions

The project includes comprehensive CI/CD workflows:

```yaml
# .github/workflows/test.yml
- Unit tests on Python 3.9, 3.10, 3.11
- Integration tests for all server modes
- Feature flag testing
- Multi-sport functionality testing
- Performance testing
- Security scanning
- Coverage reporting
```

### Local CI Simulation

```bash
# Run the same tests as CI
pytest tests/unit/ -v --cov=. --cov-report=xml
pytest tests/integration/ -v

# Test all server modes
VERVEQ_SERVER_MODE=minimal pytest tests/integration/test_server_modes.py -k "minimal"
VERVEQ_SERVER_MODE=standard pytest tests/integration/test_server_modes.py -k "standard"
VERVEQ_SERVER_MODE=full pytest tests/integration/test_server_modes.py -k "full"

# Run security checks
bandit -r . -f json
safety check
```

## 🛠️ Writing New Tests

### Test File Naming

- Unit tests: `tests/unit/test_<component>.py`
- Integration tests: `tests/integration/test_<feature>.py`
- Use descriptive names that match the component being tested

### Test Class and Method Naming

```python
class TestQuizGenerator:
    """Test QuizGenerator functionality."""
    
    def test_generate_basic_quiz(self):
        """Test basic quiz generation."""
        pass
    
    def test_generate_quiz_invalid_competition(self):
        """Test quiz generation with invalid competition ID."""
        pass
```

### Using Fixtures

```python
def test_quiz_generation(self, mock_data_handler, mock_quiz_generator):
    """Test using predefined fixtures."""
    # Fixtures are automatically injected
    questions = mock_quiz_generator.generate_quiz("test_comp", 5)
    assert len(questions) == 5
```

### Adding Test Markers

```python
@pytest.mark.unit
@pytest.mark.requires_data
def test_data_loading(self):
    """Test with multiple markers."""
    pass
```

## 🐛 Troubleshooting

### Common Issues

1. **Import Errors**: Ensure you're running tests from the project root
2. **Missing Dependencies**: Install test dependencies with `pip install -r requirements-test.txt`
3. **Environment Variables**: Some tests require specific environment variables
4. **Data Files**: Some tests require test data files to be present

### Debug Test Failures

```bash
# Run with maximum verbosity
pytest -vvv --tb=long --showlocals

# Run single test with debugging
pytest tests/unit/test_quiz_generator.py::test_generate_basic_quiz -vvv -s

# Use pdb for interactive debugging
pytest --pdb tests/unit/test_quiz_generator.py::test_generate_basic_quiz
```

## 📊 Coverage Goals

- **Overall Coverage**: Aim for 80%+ code coverage
- **Critical Components**: 90%+ coverage for core functionality
- **New Features**: 100% coverage for new code
- **Integration Points**: Comprehensive testing of API endpoints and server modes

## 🔗 Related Documentation

- [UNIFIED_SERVER_README.md](UNIFIED_SERVER_README.md) - Server configuration and usage
- [pytest.ini](pytest.ini) - Pytest configuration
- [tox.ini](tox.ini) - Tox configuration for multiple environments
- [.github/workflows/test.yml](.github/workflows/test.yml) - CI/CD configuration
