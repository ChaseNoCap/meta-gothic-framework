#!/bin/bash

# Simple Cosmo Router startup script

# Generate router config from compose.yaml
echo "Generating router configuration..."
wgc router compose -i compose.yaml -o config.json

# Start the router
echo "Starting Cosmo Router..."
./router/router --config router.yaml