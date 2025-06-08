#!/bin/bash

echo "=== Testing Session ID Branching Theory ==="
echo "Theory: Each message creates a resumable checkpoint via its session ID"
echo

# Message 1
echo "Message 1: Setting up context"
RESPONSE1=$(claude -p "My name is Alice and I love pizza" --print --output-format json 2>&1)
SESSION1=$(echo "$RESPONSE1" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session ID 1: $SESSION1"
echo

# Message 2 (continue from message 1)
echo "Message 2: Adding more context"
RESPONSE2=$(claude -p --resume "$SESSION1" "My favorite color is blue" --print --output-format json 2>&1)
SESSION2=$(echo "$RESPONSE2" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session ID 2: $SESSION2"
echo

# Message 3 (continue from message 2)
echo "Message 3: Adding even more context"
RESPONSE3=$(claude -p --resume "$SESSION2" "I work as a developer" --print --output-format json 2>&1)
SESSION3=$(echo "$RESPONSE3" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Session ID 3: $SESSION3"
echo

# Now the key test - can we branch from ANY previous point?

echo "=== BRANCH TEST 1: Resume from SESSION 1 (should only know about Alice and pizza) ==="
BRANCH1=$(claude -p --resume "$SESSION1" "What do you know about me?" --print --output-format json 2>&1)
RESULT1=$(echo "$BRANCH1" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Branch 1 result: $RESULT1"
echo

echo "=== BRANCH TEST 2: Resume from SESSION 2 (should know about Alice, pizza, AND blue) ==="
BRANCH2=$(claude -p --resume "$SESSION2" "What do you know about me?" --print --output-format json 2>&1)
RESULT2=$(echo "$BRANCH2" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Branch 2 result: $RESULT2"
echo

echo "=== BRANCH TEST 3: Resume from SESSION 3 (should know everything) ==="
BRANCH3=$(claude -p --resume "$SESSION3" "What do you know about me?" --print --output-format json 2>&1)
RESULT3=$(echo "$BRANCH3" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Branch 3 result: $RESULT3"
echo

echo "=== ANALYSIS ==="
echo "If this works correctly:"
echo "- Branch 1 should only mention Alice and pizza"
echo "- Branch 2 should mention Alice, pizza, and blue"
echo "- Branch 3 should mention Alice, pizza, blue, and developer"
echo
echo "This would mean EVERY session ID is a checkpoint we can branch from!"