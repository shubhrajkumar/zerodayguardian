#!/bin/bash

# Zero Day Guardian - Tool Configuration Management System Deployment Script
# This script deploys the complete tool configuration management system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="zeroday-guardian"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
ENVIRONMENT=${ENVIRONMENT:-"production"}
NODE_ENV=${NODE_ENV:-"production"}

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check if Docker is installed (optional)
    if command -v docker &> /dev/null; then
        log "Docker found - will use containerized deployment"
        USE_DOCKER=true
    else
        warning "Docker not found - will use local deployment"
        USE_DOCKER=false
    fi
    
    success "Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install backend dependencies
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        log "Installing backend dependencies..."
        npm install
        success "Backend dependencies installed"
        cd ..
    fi
    
    # Install frontend dependencies
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        log "Installing frontend dependencies..."
        npm install
        success "Frontend dependencies installed"
        cd ..
    fi
}

# Build the application
build_application() {
    log "Building application for $ENVIRONMENT environment..."
    
    # Build backend
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        log "Building backend..."
        npm run build
        success "Backend built successfully"
        cd ..
    fi
    
    # Build frontend
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        log "Building frontend..."
        npm run build
        success "Frontend built successfully"
        cd ..
    fi
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        
        # Run database migrations
        log "Running database migrations..."
        npm run migrate
        
        # Seed database with initial data
        log "Seeding database..."
        npm run seed
        
        success "Database setup completed"
        cd ..
    fi
}

# Setup environment variables
setup_environment() {
    log "Setting up environment variables..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log "Creating .env file from template..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            warning "Please update .env file with your configuration"
        else
            error ".env.example file not found"
            exit 1
        fi
    fi
    
    # Validate required environment variables
    required_vars=("NODE_ENV" "PORT" "MONGODB_URI" "JWT_SECRET")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            warning "Environment variable $var is not set"
        fi
    done
    
    success "Environment setup completed"
}

# Start services
start_services() {
    log "Starting services..."
    
    # Start backend
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        log "Starting backend service..."
        
        if [ "$USE_DOCKER" = true ]; then
            docker-compose up -d backend
        else
            npm start &
            BACKEND_PID=$!
        fi
        
        success "Backend service started"
        cd ..
    fi
    
    # Start frontend
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        log "Starting frontend service..."
        
        if [ "$USE_DOCKER" = true ]; then
            docker-compose up -d frontend
        else
            npm run dev &
            FRONTEND_PID=$!
        fi
        
        success "Frontend service started"
        cd ..
    fi
}

# Run tests
run_tests() {
    log "Running tests..."
    
    # Run backend tests
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        log "Running backend tests..."
        npm test
        success "Backend tests completed"
        cd ..
    fi
    
    # Run frontend tests
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        log "Running frontend tests..."
        npm test
        success "Frontend tests completed"
        cd ..
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if services are running
    sleep 5
    
    # Check backend health
    if curl -f http://localhost:3000/api/health &> /dev/null; then
        success "Backend health check passed"
    else
        warning "Backend health check failed"
    fi
    
    # Check frontend health
    if curl -f http://localhost:5173 &> /dev/null; then
        success "Frontend health check passed"
    else
        warning "Frontend health check failed"
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    success "Cleanup completed"
}

# Main deployment function
deploy() {
    log "Starting deployment of $PROJECT_NAME..."
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    setup_environment
    install_dependencies
    build_application
    setup_database
    start_services
    health_check
    
    # Run tests in production environment
    if [ "$ENVIRONMENT" = "production" ]; then
        run_tests
    fi
    
    success "Deployment completed successfully!"
    log "Frontend: http://localhost:5173"
    log "Backend API: http://localhost:3000"
    log "Tool Configuration Management System is ready!"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "build")
        check_prerequisites
        install_dependencies
        build_application
        ;;
    "start")
        start_services
        ;;
    "test")
        run_tests
        ;;
    "clean")
        cleanup
        ;;
    "help")
        echo "Usage: $0 [deploy|build|start|test|clean|help]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full deployment (default)"
        echo "  build     - Build application only"
        echo "  start     - Start services only"
        echo "  test      - Run tests only"
        echo "  clean     - Clean up processes"
        echo "  help      - Show this help"
        ;;
    *)
        error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac