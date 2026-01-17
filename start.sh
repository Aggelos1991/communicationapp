#!/bin/bash

echo "🚀 Starting Invoice Tracker with Docker + MySQL..."

# Check if .env files exist
if [ ! -f server/.env ]; then
    echo "📝 Creating server/.env from template..."
    cp server/.env.example server/.env
    echo "⚠️  IMPORTANT: Edit server/.env and set JWT_SECRET and passwords!"
fi

if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd server && npm install && cd ..

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
sleep 10

echo "✅ Done!"
echo ""
echo "📊 Services:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo "  MySQL:    localhost:3306"
echo ""
echo "📝 Next steps:"
echo "  1. Open http://localhost:5173"
echo "  2. Create your first user account"
echo ""
echo "🔧 View logs: docker-compose logs -f"
echo "🛑 Stop: docker-compose down"
