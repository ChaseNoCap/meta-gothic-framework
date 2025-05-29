# ADR-016: Local NPM Authentication Strategy

## Status
Accepted

## Context
The project uses GitHub Packages as the package registry for all @chasenocap scoped packages. Developers need to authenticate to GitHub Packages for both consuming packages during development and publishing packages. The authentication approach must be:

1. **Secure**: No tokens committed to the repository
2. **Consistent**: Same approach across all packages and environments
3. **Flexible**: Support both local development and CI/CD pipelines
4. **Simple**: Easy for developers to set up

## Decision
We will use environment variable-based authentication with NPM_TOKEN for all local development and CI/CD scenarios.

### Authentication Architecture

#### Local Development
- **Token Storage**: Environment variable `NPM_TOKEN`
- **Configuration**: `.npmrc` files use `${NPM_TOKEN}` placeholder
- **Scope**: Personal Access Token (PAT) with `read:packages` and `write:packages` scopes
- **Setup Location**: User's shell profile (~/.zshrc, ~/.bashrc)

#### CI/CD Pipelines
- **Token Storage**: Repository secret `PAT_TOKEN` 
- **Runtime Mapping**: `NPM_TOKEN` environment variable set from `secrets.PAT_TOKEN`
- **Scope**: Same PAT with extended permissions for repository operations

### Implementation Details

#### .npmrc Configuration
All packages contain identical `.npmrc` files:
```
@chasenocap:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

#### Global Configuration
Users maintain global npm configuration in `~/.npmrc`:
```
@chasenocap:registry=https://npm.pkg.github.com
registry=https://registry.npmjs.org/
```

#### Required Token Scopes
- `read:packages` - Download @chasenocap packages
- `write:packages` - Publish packages (for maintainers)
- `repo` - Access private repositories (CI/CD only)

### Developer Setup Process

1. **Create Personal Access Token**
   - Navigate to GitHub Settings → Developer Settings → Personal Access Tokens
   - Generate token with required scopes
   - Set 90-day expiration for security

2. **Configure Environment**
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export NPM_TOKEN="ghp_your_token_here"
   
   # Reload shell
   source ~/.zshrc
   ```

3. **Verify Setup**
   ```bash
   # Test authentication
   npm view @chasenocap/logger --registry https://npm.pkg.github.com
   
   # Install packages
   cd /path/to/project
   npm install
   ```

## Alternatives Considered

### Alternative 1: npm login
**Rejected**: npm login stores credentials in plaintext in global .npmrc, creating security concerns and requiring manual login renewal.

### Alternative 2: Per-package .npmrc with hardcoded tokens
**Rejected**: Risk of accidentally committing tokens to version control.

### Alternative 3: GitHub CLI authentication
**Rejected**: Adds additional dependency and complexity; not all developers use gh CLI.

### Alternative 4: Different tokens for development vs CI
**Rejected**: Increases complexity and maintenance overhead without significant security benefits.

## Consequences

### Positive
- **Security**: Tokens never committed to repositories
- **Consistency**: Same authentication method across all environments
- **Automation-Friendly**: Environment variables work in all CI/CD systems
- **Token Management**: Single token per developer, centralized rotation
- **Debugging**: Clear error messages when authentication fails

### Negative
- **Initial Setup**: Developers must configure environment variable
- **Token Rotation**: Manual process every 90 days
- **Troubleshooting**: Authentication failures require checking environment variables

### Operational Impact
- **Onboarding**: New developers need GitHub PAT setup documentation
- **Security**: Regular token rotation reminders needed
- **Monitoring**: Authentication failures visible in npm error logs

## Implementation Status
- ✅ All existing packages configured with .npmrc
- ✅ CI/CD pipelines use environment variable mapping
- ✅ Documentation updated in github-packages-auth-setup.md
- ✅ New packages automatically get correct .npmrc configuration

## Security Considerations
- Tokens stored only in user environment variables and CI secrets
- Regular rotation policy (90 days recommended)
- Minimal scope principle applied
- No fallback to less secure authentication methods

## Related ADRs
- ADR-003: Automated Publishing Infrastructure (CI/CD token usage)
- ADR-002: Git Submodules Architecture (same PAT for repository access)

## References
- [GitHub Packages npm authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [npm configuration documentation](https://docs.npmjs.com/cli/v7/configuring-npm/npmrc)
- [Personal Access Token scopes](https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps)