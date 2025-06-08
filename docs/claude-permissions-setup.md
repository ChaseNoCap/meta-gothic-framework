# Claude Service Permission Configuration

## Overview

The Claude service now supports configurable permissions for tool usage (Bash, Read, Write, Edit). This allows you to control what actions Claude can perform without granting blanket permissions.

## Configuration Methods

### 1. **Configuration File** (Recommended)

Create `claude-config.json` in the Claude service directory:

```json
{
  "permissions": {
    "allowedTools": ["Bash", "Read", "Write", "Edit"],
    "allowPatterns": {
      "Bash": [
        "echo:*",
        "ls:*", 
        "pwd",
        "cd:*",
        "cat:*",
        "sleep:*",
        "bash:*",
        "node:*",
        "npm:*",
        "git status",
        "git diff:*"
      ]
    },
    "denyPatterns": {
      "Bash": [
        "rm -rf:*",
        "sudo:*",
        "curl:*"
      ]
    }
  }
}
```

### 2. **Environment Variable** (Development Only)

For development/testing, you can enable dangerous mode:

```bash
# In ecosystem.config.cjs
env: {
  CLAUDE_DANGEROUS_MODE: 'true'  // Grants all permissions
}
```

### 3. **Command Line Flags**

The service automatically adds `--allowedTools` flags when spawning Claude CLI:
- Default: `Bash,Read,Write,Edit`
- Configured via `claude-config.json`

## Known Issues

1. **Non-Interactive Mode Bug**: Claude CLI has a known issue where `--allowedTools` isn't properly respected in non-interactive mode with `-p` flag.

2. **Permission Prompts**: Even with allowed tools configured, Claude may still ask for permissions in the response.

## Solutions

### Option 1: Use Dangerous Mode (Development)
```bash
# Set environment variable
export CLAUDE_DANGEROUS_MODE=true

# Or in PM2 ecosystem config
env: {
  CLAUDE_DANGEROUS_MODE: 'true'
}
```

### Option 2: Interactive Mode
Instead of using `-p` flag, consider using interactive mode where permissions work correctly.

### Option 3: Custom Wrapper
Create a wrapper script that handles permissions before calling Claude.

## Security Considerations

1. **Never use dangerous mode in production**
2. **Limit bash commands** to safe operations
3. **Use pattern-based permissions** for fine-grained control
4. **Regularly audit** allowed commands

## Testing Permissions

Test script to verify permissions:

```bash
# Test basic echo command
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { executeCommand(input: {prompt: \"echo Hello World\"}) { sessionId success } }"
  }'

# Test file operations
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { executeCommand(input: {prompt: \"Create a test.txt file with Hello content\"}) { sessionId success } }"
  }'
```

## Monitoring

Check logs for permission usage:
```bash
pm2 logs claude-service | grep -i "permission\|allowed\|dangerous"
```

## Future Improvements

1. **Implement permission validation** in ClaudeSessionManager before executing
2. **Add audit logging** for all tool usage
3. **Create permission presets** (read-only, developer, admin)
4. **Implement rate limiting** for dangerous operations