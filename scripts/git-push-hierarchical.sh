#!/bin/bash

# Hierarchical Git Push Script for Meta-Gothic Framework
# This script pushes changes in the correct order: submodules first, then parent repo

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo -e "${BLUE}🚀 Meta-Gothic Framework - Hierarchical Git Push${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Function to check if there are commits to push
has_commits_to_push() {
    local dir="$1"
    cd "$dir"
    
    # Check if we have a remote
    if ! git remote | grep -q origin; then
        return 1
    fi
    
    # Check if branch has upstream
    if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} &>/dev/null; then
        return 1
    fi
    
    # Check if there are commits to push
    if [[ -n $(git log @{u}.. 2>/dev/null) ]]; then
        return 0
    else
        return 1
    fi
}

# Function to push changes
push_changes() {
    local dir="$1"
    local name="$2"
    
    cd "$dir"
    
    if has_commits_to_push "$dir"; then
        echo -e "${YELLOW}🚀 Pushing $name...${NC}"
        
        # Show what will be pushed
        echo -e "${BLUE}Commits to push:${NC}"
        git log @{u}.. --oneline
        echo ""
        
        if git push; then
            echo -e "${GREEN}✓ Successfully pushed $name${NC}\n"
            return 0
        else
            echo -e "${RED}✗ Failed to push $name${NC}\n"
            return 1
        fi
    else
        # Check if branch exists on remote
        local branch=$(git rev-parse --abbrev-ref HEAD)
        if ! git ls-remote --heads origin "$branch" | grep -q "$branch"; then
            echo -e "${YELLOW}📤 Branch '$branch' doesn't exist on remote for $name${NC}"
            echo -e "${YELLOW}   Creating remote branch...${NC}"
            
            if git push -u origin "$branch"; then
                echo -e "${GREEN}✓ Created remote branch and pushed $name${NC}\n"
                return 0
            else
                echo -e "${RED}✗ Failed to create remote branch for $name${NC}\n"
                return 1
            fi
        else
            echo -e "${GREEN}✓ $name is up to date with remote${NC}\n"
        fi
        return 0
    fi
}

# Track push results
PUSH_FAILED=()
PUSH_SUCCESS=()

# Step 1: Push all submodules first
echo -e "${BLUE}Step 1: Pushing submodules...${NC}\n"

for submodule in packages/*; do
    if [ -d "$submodule/.git" ]; then
        submodule_name=$(basename "$submodule")
        
        if push_changes "$submodule" "$submodule_name"; then
            PUSH_SUCCESS+=("$submodule_name")
        else
            PUSH_FAILED+=("$submodule_name")
        fi
    fi
done

# Step 2: Push parent repository
echo -e "${BLUE}Step 2: Pushing parent repository...${NC}\n"

if push_changes "$ROOT_DIR" "parent repository"; then
    PUSH_SUCCESS+=("parent repository")
else
    PUSH_FAILED+=("parent repository")
fi

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Push Summary:${NC}"
echo -e "${BLUE}========================================${NC}\n"

if [ ${#PUSH_SUCCESS[@]} -gt 0 ]; then
    echo -e "${GREEN}✅ Successfully pushed:${NC}"
    for item in "${PUSH_SUCCESS[@]}"; do
        echo -e "   - $item"
    done
    echo ""
fi

if [ ${#PUSH_FAILED[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed to push:${NC}"
    for item in "${PUSH_FAILED[@]}"; do
        echo -e "   - $item"
    done
    echo ""
    echo -e "${YELLOW}⚠️  Some repositories failed to push. Please check the errors above.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All repositories pushed successfully!${NC}"
fi

# Show current status
echo -e "\n${BLUE}Current Status:${NC}"
cd "$ROOT_DIR"
git status --short
echo -e "\n${BLUE}Submodule Status:${NC}"
git submodule status