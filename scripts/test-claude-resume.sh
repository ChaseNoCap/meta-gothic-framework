#!/bin/bash

echo "=== Testing Claude --resume Session Behavior ==="
echo

# Test 1: Create initial session
echo "Test 1: Creating initial session..."
RESPONSE1=$(claude -p "My name is Josh and my favorite number is 42" --output-format json 2>&1)
SESSION1=$(echo "$RESPONSE1" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session ID 1: $SESSION1"
echo

# Test 2: Resume with the session ID
echo "Test 2: Resuming with session ID..."
echo "Command: claude -p --resume $SESSION1 \"What is my name and favorite number?\""
RESPONSE2=$(claude -p --resume "$SESSION1" "What is my name and favorite number?" --output-format json 2>&1)
SESSION2=$(echo "$RESPONSE2" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
RESULT2=$(echo "$RESPONSE2" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session ID 2: $SESSION2"
echo "Response: $RESULT2"
echo

# Test 3: Resume again with the FIRST session ID
echo "Test 3: Resuming again with FIRST session ID..."
echo "Command: claude -p --resume $SESSION1 \"Just to confirm, what was my name?\""
RESPONSE3=$(claude -p --resume "$SESSION1" "Just to confirm, what was my name?" --output-format json 2>&1)
SESSION3=$(echo "$RESPONSE3" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
RESULT3=$(echo "$RESPONSE3" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session ID 3: $SESSION3"
echo "Response: $RESULT3"
echo

# Test 4: Resume with the SECOND session ID
echo "Test 4: Resuming with SECOND session ID..."
echo "Command: claude -p --resume $SESSION2 \"What information do you remember about me?\""
RESPONSE4=$(claude -p --resume "$SESSION2" "What information do you remember about me?" --output-format json 2>&1)
SESSION4=$(echo "$RESPONSE4" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
RESULT4=$(echo "$RESPONSE4" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session ID 4: $SESSION4"
echo "Response: $RESULT4"
echo

# Test 5: Check if sessions directory contains these IDs
echo "Test 5: Looking for session files..."
find ~/.claude -name "*$SESSION1*" -type f 2>/dev/null | head -5
find ~/.claude -name "*$SESSION2*" -type f 2>/dev/null | head -5
echo

# Summary
echo "=== Analysis ==="
echo "Session IDs generated:"
echo "  1: $SESSION1"
echo "  2: $SESSION2 (should be same as 1 if resume works)"
echo "  3: $SESSION3 (should be same as 1 if resume works)"
echo "  4: $SESSION4 (should be same as 2 if resume works)"
echo

if [[ "$SESSION1" == "$SESSION2" ]]; then
    echo "✅ Session IDs match when using --resume!"
else
    echo "❌ Session IDs DO NOT match when using --resume"
fi

echo
echo "Context preservation check:"
if echo "$RESULT2" | grep -i "josh" > /dev/null && echo "$RESULT2" | grep -i "42" > /dev/null; then
    echo "✅ Context IS preserved (found Josh and 42)"
else
    echo "❌ Context NOT preserved"
fi