#!/bin/bash

# The ONE TRUE script to consolidate gateway configuration
# This uses the working config and ensures all services are properly configured

echo "🔧 Consolidating gateway configuration..."

# Check if we have a working config
if [ ! -f "config-working.json" ]; then
  echo "❌ No working configuration found (config-working.json)"
  echo "Using config-new.json as fallback..."
  if [ -f "config-new.json" ]; then
    cp config-new.json config-working.json
  else
    echo "❌ No fallback configuration found"
    exit 1
  fi
fi

# Use the working configuration
cp config-working.json config.json
cp config-working.json router-execution-config.json

echo "✅ Configuration consolidated"
echo "📄 Active configuration: config.json"
echo "📄 Execution configuration: router-execution-config.json"
echo ""
echo "🚀 Restart the gateway with: pm2 restart gateway"