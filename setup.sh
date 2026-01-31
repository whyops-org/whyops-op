#!/bin/bash

echo "🚀 WhyOps Setup Script"
echo "====================="

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun not found. Installing..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

echo "✅ Bun installed: $(bun --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
bun install

# Copy environment file
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
else
    echo "✅ .env file already exists"
fi

# Check if PostgreSQL is running
echo ""
echo "🔍 Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    if psql -U postgres -c '\l' &> /dev/null; then
        echo "✅ PostgreSQL is running"
    else
        echo "⚠️  PostgreSQL is installed but not running"
        echo "   Start it with: brew services start postgresql (macOS)"
        echo "   Or: sudo service postgresql start (Linux)"
    fi
else
    echo "⚠️  PostgreSQL not found"
    echo "   Option 1: Install locally"
    echo "     macOS: brew install postgresql"
    echo "     Ubuntu: sudo apt-get install postgresql"
    echo ""
    echo "   Option 2: Use Docker"
    echo "     docker run -d --name whyops-postgres \\"
    echo "       -e POSTGRES_DB=whyops \\"
    echo "       -e POSTGRES_USER=postgres \\"
    echo "       -e POSTGRES_PASSWORD=postgres \\"
    echo "       -p 5432:5432 postgres:16-alpine"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start PostgreSQL (if not running)"
echo "3. Run: bun run dev"
echo ""
echo "Services will run on:"
echo "  - Proxy:   http://localhost:8080"
echo "  - Analyse: http://localhost:8081"
echo "  - Auth:    http://localhost:8082"
