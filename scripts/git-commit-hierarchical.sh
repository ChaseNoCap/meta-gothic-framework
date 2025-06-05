#!/bin/bash

# Hierarchical Git Commit Script for Meta-Gothic Framework
# This script commits changes in the correct order: submodules first, then parent repo

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

echo -e "${BLUE}🔍 Meta-Gothic Framework - Hierarchical Git Commit${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Function to check if a directory has uncommitted changes
has_changes() {
    local dir="$1"
    cd "$dir"
    if [[ -n $(git status --porcelain) ]]; then
        return 0
    else
        return 1
    fi
}

# Function to commit changes in a directory
commit_changes() {
    local dir="$1"
    local name="$2"
    local commit_msg="$3"
    
    cd "$dir"
    
    echo -e "${YELLOW}📦 Processing $name...${NC}"
    
    if ! has_changes "$dir"; then
        echo -e "${GREEN}✓ No changes to commit in $name${NC}\n"
        return 0
    fi
    
    echo -e "${BLUE}Changes detected in $name:${NC}"
    git status --short
    echo ""
    
    # Stage all changes
    git add -A
    
    # Commit with the provided message
    if git commit -m "$commit_msg"; then
        echo -e "${GREEN}✓ Committed changes in $name${NC}\n"
        return 0
    else
        echo -e "${RED}✗ Failed to commit in $name${NC}\n"
        return 1
    fi
}

# Function to push changes
push_changes() {
    local dir="$1"
    local name="$2"
    
    cd "$dir"
    
    # Check if there are commits to push
    if [[ -n $(git log @{u}.. 2>/dev/null) ]]; then
        echo -e "${YELLOW}🚀 Pushing $name...${NC}"
        if git push; then
            echo -e "${GREEN}✓ Pushed $name${NC}\n"
            return 0
        else
            echo -e "${RED}✗ Failed to push $name${NC}\n"
            return 1
        fi
    else
        echo -e "${GREEN}✓ $name is up to date with remote${NC}\n"
        return 0
    fi
}

# Get commit message from user
if [ -z "$1" ]; then
    echo -e "${YELLOW}Please provide a commit message:${NC}"
    read -r COMMIT_MSG
else
    COMMIT_MSG="$1"
fi

if [ -z "$COMMIT_MSG" ]; then
    echo -e "${RED}✗ Commit message cannot be empty${NC}"
    exit 1
fi

echo -e "\n${BLUE}Commit message: ${NC}$COMMIT_MSG\n"

# Track which submodules were updated
UPDATED_SUBMODULES=()

# Step 1: Process all submodules first
echo -e "${BLUE}Step 1: Processing submodules...${NC}\n"

for submodule in packages/*; do
    if [ -d "$submodule/.git" ]; then
        submodule_name=$(basename "$submodule")
        
        if has_changes "$submodule"; then
            commit_changes "$submodule" "$submodule_name" "$COMMIT_MSG"
            UPDATED_SUBMODULES+=("$submodule_name")
        fi
    fi
done

# Step 2: Update submodule references in parent repo
if [ ${#UPDATED_SUBMODULES[@]} -gt 0 ]; then
    echo -e "${BLUE}Step 2: Updating submodule references in parent repo...${NC}\n"
    cd "$ROOT_DIR"
    
    for submodule in "${UPDATED_SUBMODULES[@]}"; do
        git add "packages/$submodule"
        echo -e "${GREEN}✓ Updated reference for $submodule${NC}"
    done
    echo ""
fi

# Step 3: Commit parent repo changes
echo -e "${BLUE}Step 3: Committing parent repository...${NC}\n"
cd "$ROOT_DIR"

if has_changes "$ROOT_DIR"; then
    # Check what's being committed
    echo -e "${BLUE}Changes to be committed:${NC}"
    git status --short
    echo ""
    
    # Stage everything except submodules (they're already staged)
    git add -A
    
    # Create commit message with submodule info if applicable
    if [ ${#UPDATED_SUBMODULES[@]} -gt 0 ]; then
        FULL_MSG="$COMMIT_MSG"$'\n\n'"Updated submodules: ${UPDATED_SUBMODULES[*]}"
    else
        FULL_MSG="$COMMIT_MSG"
    fi
    
    if git commit -m "$FULL_MSG"; then
        echo -e "${GREEN}✓ Committed parent repository${NC}\n"
    else
        echo -e "${RED}✗ Failed to commit parent repository${NC}\n"
    fi
else
    echo -e "${GREEN}✓ No changes to commit in parent repository${NC}\n"
fi

# Step 4: Push all changes (submodules first, then parent)
echo -e "${BLUE}Step 4: Pushing changes to remote...${NC}\n"

# Ask user if they want to push
echo -e "${YELLOW}Do you want to push all changes to remote? (y/n)${NC}"
read -r PUSH_CONFIRM

if [[ "$PUSH_CONFIRM" =~ ^[Yy]$ ]]; then
    # Push submodules first
    for submodule in packages/*; do
        if [ -d "$submodule/.git" ]; then
            submodule_name=$(basename "$submodule")
            push_changes "$submodule" "$submodule_name"
        fi
    done
    
    # Push parent repo
    push_changes "$ROOT_DIR" "parent repository"
    
    echo -e "${GREEN}✅ All changes have been committed and pushed!${NC}"
else
    echo -e "${YELLOW}⚠️  Changes committed locally but not pushed${NC}"
    echo -e "${YELLOW}   Run 'git push --recurse-submodules=on-demand' to push later${NC}"
fi

# Final status
echo -e "\n${BLUE}Final Status:${NC}"
cd "$ROOT_DIR"
git status
echo -e "\n${BLUE}Submodule Status:${NC}"
git submodule status