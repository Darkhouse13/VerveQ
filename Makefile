# VerveQ Dependency Management Makefile
# Provides convenient commands for managing dependencies with pip-tools

.PHONY: help install install-dev install-test compile-deps update-deps clean-deps check-deps frontend-setup frontend-dev frontend-build

help:  ## Show this help message
	@echo "VerveQ Dependency Management Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install:  ## Install production dependencies
	pip install -r requirements.txt

install-dev:  ## Install development dependencies
	pip install -r requirements-dev.txt

install-test:  ## Install testing dependencies
	pip install -r requirements-test.txt

compile-deps:  ## Compile .in files to .txt files with pinned versions
	pip-compile requirements.in
	pip-compile requirements-dev.in
	pip-compile requirements-test.in

update-deps:  ## Update all dependencies to latest compatible versions
	pip-compile --upgrade requirements.in
	pip-compile --upgrade requirements-dev.in
	pip-compile --upgrade requirements-test.in

clean-deps:  ## Remove compiled requirements files
	rm -f requirements.txt.lock
	rm -f requirements-dev.txt.lock
	rm -f requirements-test.txt.lock

check-deps:  ## Check for security vulnerabilities in dependencies
	pip install safety
	safety check -r requirements.txt
	safety check -r requirements-dev.txt
	safety check -r requirements-test.txt

sync-deps:  ## Sync installed packages with requirements (removes unused packages)
	pip-sync requirements.txt

sync-dev:  ## Sync installed packages with dev requirements
	pip-sync requirements-dev.txt

sync-test:  ## Sync installed packages with test requirements
	pip-sync requirements-test.txt

outdated:  ## Show outdated packages
	pip list --outdated

freeze:  ## Show currently installed packages
	pip freeze

# Windows-specific commands (use these on Windows systems)
install-win:  ## Install production dependencies (Windows)
	pip install -r requirements.txt

compile-deps-win:  ## Compile dependencies (Windows)
	pip-compile requirements.in
	pip-compile requirements-dev.in
	pip-compile requirements-test.in

# Frontend build commands
frontend-setup:  ## Setup frontend build environment
	npm install
	npm run setup

frontend-dev:  ## Start frontend development server
	npm run dev

frontend-build:  ## Build frontend for production
	npm run build

frontend-clean:  ## Clean frontend build artifacts
	npm run clean
