#!/bin/bash

# Quality Service startup script
echo "🔍 Starting Quality Service..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check if built
if [ ! -d "dist" ]; then
  echo "🔨 Building Quality Service..."
  npm run build
fi

# Check database connection
echo "🗄️  Checking database connection..."
if ! /opt/homebrew/opt/postgresql@17/bin/psql -U josh -d quality_service -c "SELECT 1" >/dev/null 2>&1; then
  echo "⚠️  Database 'quality_service' not accessible. Service will start but may have limited functionality."
  echo "   Run 'npm run db:setup' to set up the database."
else
  echo "✅ Database connection verified"
fi

# Start the service
echo "🚀 Starting Quality Service..."
echo "   MCP Server on port ${MCP_PORT:-3006}"
echo "   GraphQL Server on port ${GRAPHQL_PORT:-3007}"
exec npm run start