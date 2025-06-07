#!/bin/bash

# Download router binary if not exists
if [ ! -f "./router/router" ]; then
    echo "Downloading Cosmo Router binary..."
    mkdir -p router
    
    # Detect platform
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    
    case "$OS" in
        Darwin)
            if [[ "$ARCH" == "arm64" ]]; then
                BINARY_NAME="router-darwin-arm64"
            else
                BINARY_NAME="router-darwin-amd64"
            fi
            ;;
        Linux)
            BINARY_NAME="router-linux-amd64"
            ;;
        *)
            echo "Unsupported platform: $OS"
            exit 1
            ;;
    esac
    
    wget "https://github.com/wundergraph/cosmo/releases/latest/download/$BINARY_NAME" -O router/router
    chmod +x router/router
fi

# Check if wgc is installed
if ! command -v wgc &> /dev/null; then
    echo "Error: wgc CLI not found. Please install it with: npm install -g wgc"
    exit 1
fi

# Generate config
echo "Generating router configuration..."
wgc router compose -i compose.yaml -o config.json

# Set environment variables
export CONFIG_PATH=./config.yaml
export EXECUTION_CONFIG_FILE_PATH=./config.json
export DEV_MODE=true

# Run router
echo "Starting Cosmo Router on http://localhost:4000..."
./router/router