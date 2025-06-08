#!/bin/bash

echo "=== Testing Claude Session Memory ==="
echo

# Test 1: Basic Claude CLI session
echo "Test 1: Creating initial session..."
echo "Command: claude -p \"Remember the number 42\" --print --output-format json"
RESPONSE1=$(claude -p "Remember the number 42" --print --output-format json 2>&1)
echo "Response:"
echo "$RESPONSE1"
echo

# Extract session ID if present
SESSION_ID=$(echo "$RESPONSE1" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
CONVERSATION_ID=$(echo "$RESPONSE1" | grep -o '"conversation_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

echo "Extracted session_id: $SESSION_ID"
echo "Extracted conversation_id: $CONVERSATION_ID"
echo

# Test 2: Try to continue the conversation
echo "Test 2: Testing --continue flag..."
echo "Command: claude -c -p \"What number did I ask you to remember?\" --print --output-format json"
RESPONSE2=$(claude -c -p "What number did I ask you to remember?" --print --output-format json 2>&1)
echo "Response:"
echo "$RESPONSE2"
echo

# Test 3: Try resume with session ID (if we found one)
if [ ! -z "$SESSION_ID" ]; then
    echo "Test 3: Testing --resume with session ID..."
    echo "Command: claude -r $SESSION_ID -p \"What number am I thinking of?\" --print --output-format json"
    RESPONSE3=$(claude -r "$SESSION_ID" -p "What number am I thinking of?" --print --output-format json 2>&1)
    echo "Response:"
    echo "$RESPONSE3"
elif [ ! -z "$CONVERSATION_ID" ]; then
    echo "Test 3: Testing --resume with conversation ID..."
    echo "Command: claude -r $CONVERSATION_ID -p \"What number am I thinking of?\" --print --output-format json"
    RESPONSE3=$(claude -r "$CONVERSATION_ID" -p "What number am I thinking of?" --print --output-format json 2>&1)
    echo "Response:"
    echo "$RESPONSE3"
else
    echo "Test 3: Skipped - no session/conversation ID found"
fi
echo

# Test 4: Check if sessions directory exists
echo "Test 4: Looking for session storage..."
for dir in ~/.claude/sessions ~/.config/claude/sessions ~/.claude ~/.config/claude; do
    if [ -d "$dir" ]; then
        echo "Found directory: $dir"
        echo "Contents:"
        ls -la "$dir" | head -10
    fi
done
echo

# Test 5: Test our service logs
echo "Test 5: Checking service logs for session handling..."
echo "Recent session-related logs:"
pm2 logs claude-service --lines 50 --nostream | grep -E "(session_id|conversation_id|--resume|executeCommandInSession|Session found)" | tail -20
echo

# Summary
echo "=== Summary ==="
echo "1. Check if 'session_id' or 'conversation_id' appears in responses"
echo "2. Check if --continue remembers context"
echo "3. Check if --resume works with session IDs"
echo "4. Look for session storage locations"
echo

# Check for memory of "42"
if echo "$RESPONSE2" | grep -i "42" > /dev/null; then
    echo "✅ Claude remembered '42' with --continue flag!"
else
    echo "❌ Claude did NOT remember '42' with --continue flag"
fi

if [ ! -z "$RESPONSE3" ] && echo "$RESPONSE3" | grep -i "42" > /dev/null; then
    echo "✅ Claude remembered '42' with --resume flag!"
else
    echo "❌ Claude did NOT remember '42' with --resume flag (or resume not tested)"
fi