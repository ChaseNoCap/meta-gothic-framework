#!/bin/bash

echo "=== Testing 'last message' behavior with --resume ==="
echo

# Create a conversation
echo "Step 1: Initial greeting"
RESPONSE1=$(claude -p "Hi, I'm testing sessions" --print --output-format json 2>&1)
SESSION1=$(echo "$RESPONSE1" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session 1: $SESSION1"
echo

echo "Step 2: Add more context"
RESPONSE2=$(claude -p --resume "$SESSION1" "My favorite color is blue" --print --output-format json 2>&1)
SESSION2=$(echo "$RESPONSE2" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session 2: $SESSION2"
echo

echo "Step 3: Simple thanks"
RESPONSE3=$(claude -p --resume "$SESSION1" "thanks!" --print --output-format json 2>&1)
SESSION3=$(echo "$RESPONSE3" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session 3: $SESSION3"
echo

echo "Step 4: Ask about last message using ORIGINAL session ID"
RESPONSE4=$(claude -p --resume "$SESSION1" "What was the last message I sent?" --print --output-format json 2>&1)
RESULT4=$(echo "$RESPONSE4" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Using original session ID ($SESSION1):"
echo "Result: $RESULT4"
echo

echo "Step 5: Ask about last message using MOST RECENT session ID"
RESPONSE5=$(claude -p --resume "$SESSION3" "What was the last message I sent?" --print --output-format json 2>&1)
RESULT5=$(echo "$RESPONSE5" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Using most recent session ID ($SESSION3):"
echo "Result: $RESULT5"
echo

echo "=== Analysis ==="
echo "If Claude tracks by session ID checkpoint:"
echo "- Original ID should know up to 'Hi, I'm testing sessions'"
echo "- Most recent ID should know about 'thanks!'"
echo
echo "This will tell us if we should use the most recent session ID instead of the first one."