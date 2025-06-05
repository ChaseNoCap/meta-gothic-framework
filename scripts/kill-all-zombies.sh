#!/bin/bash

echo "🧟 Killing all zombie tsx watch processes..."

# Kill all node processes running tsx watch from our project
ps aux | grep -E 'node.*meta-gothic-framework.*tsx watch' | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# Kill any vite processes from our project
ps aux | grep -E 'vite.*meta-gothic-framework' | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# Count remaining
remaining=$(ps aux | grep -E 'node.*meta-gothic-framework.*tsx watch' | grep -v grep | wc -l)

if [ "$remaining" -eq 0 ]; then
    echo "✅ All zombie processes killed!"
else
    echo "⚠️  $remaining zombie processes remaining"
fi