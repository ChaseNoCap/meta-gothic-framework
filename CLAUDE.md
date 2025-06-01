# metaGOTHIC Framework CLAUDE.md

This is the metaGOTHIC framework - an AI-Guided Opinionated TypeScript Framework with High Intelligent Components.

⚠️ **IMPORTANT**: This is the metaGOTHIC framework context. When working here, focus exclusively on AI-guided development tooling. This framework is independent and has no connection to any visa analysis systems.

## 🎯 Repository Purpose

The metaGOTHIC framework is a comprehensive AI-guided development platform that:
1. **Guides Development**: AI-assisted development workflows with Claude integration
2. **Monitors Health**: Real-time monitoring of all metaGOTHIC packages and CI/CD pipelines
3. **Controls Pipelines**: Centralized control for triggering builds, tests, and publishing
4. **Enables Dogfooding**: The framework uses itself for its own development

## 📦 Package Structure

```
metaGOTHIC/
├── packages/                     # Git submodules for metaGOTHIC packages
│   ├── claude-client/           # Claude CLI subprocess wrapper
│   ├── prompt-toolkit/          # XML template system
│   ├── sdlc-config/            # YAML-based SDLC configuration
│   ├── sdlc-engine/            # State machine for SDLC phases
│   ├── sdlc-content/           # Templates and knowledge base
│   ├── graphql-toolkit/        # GraphQL utilities
│   ├── context-aggregator/     # Intelligent context management
│   └── ui-components/          # React dashboard components
├── docs/                       # metaGOTHIC-specific documentation
├── src/                        # (Future) API server for dashboard
└── scripts/                    # (Future) Automation scripts
```

## 📊 Current State (May 2025)

### Package Development Status
- **8 packages created**: All core metaGOTHIC packages implemented
- **UI Dashboard**: Fully operational with live GitHub API integration
- **Real-time Data**: Repositories, workflows, metrics display live data
- **Production Ready**: Running at http://localhost:3001 with comprehensive error handling

### What's Working
- ✅ **Health Monitoring**: Real-time package health, build status, test coverage
- ✅ **Pipeline Control**: Trigger workflows, monitor runs, view logs
- ✅ **Repository Browser**: View all ChaseNoCap repositories with live data
- ✅ **Error Handling**: User-friendly setup guidance with retry mechanisms
- ✅ **Browser Compatibility**: Resolved all Node.js dependency issues

### What Needs Work
- ❌ **Tools Page**: ThemeContext error prevents repository tools from loading
- ❌ **Real Git Integration**: Tools page uses mock data, needs backend API
- ❌ **AI Integration**: Commit message generation needs real Claude integration
- ❌ **Event System**: Real-time updates not yet implemented
- ❌ **GraphQL Federation**: Services not yet federated

## 🚀 UI Components Package

The `ui-components` package is the primary interface for metaGOTHIC, featuring:

### Health Monitoring Dashboard
- **Real-time Status**: Monitor all package health metrics
- **Build Status**: Track CI/CD pipeline success/failure
- **Test Coverage**: Visualize test coverage across packages
- **Dependency Status**: Track outdated dependencies
- **Recent Activity**: View recent commits and workflow runs

### Pipeline Control Center
- **Quick Actions**: One-click test runs, deployments, and publishing
- **Workflow Management**: Trigger, cancel, and monitor workflows
- **Package Publishing**: Tag and publish packages with version control
- **Repository Filtering**: Focus on specific packages

## 🔧 Development Workflow

### Initial Setup
```bash
# Clone the metaGOTHIC framework
git clone --recurse-submodules https://github.com/ChaseNoCap/meta-gothic-framework
cd meta-gothic-framework

# Or initialize submodules after cloning
git submodule update --init --recursive

# Install dependencies
npm install

# Set up GitHub token for API access
export VITE_GITHUB_TOKEN=your_github_token_here
```

### Running the Dashboard
```bash
# Development mode with live reload
npm run dev

# Dashboard runs at http://localhost:3001
# Tools page (needs fix): http://localhost:3001/tools
```

### Current Development Focus
```bash
# 1. Fix Tools page ThemeContext issue
cd packages/ui-components
# Remove theme imports or create ThemeContext

# 2. Test the fix
npm run dev
# Navigate to http://localhost:3001/tools

# 3. Use the Tools page for dogfooding
# Once fixed, use it to manage metaGOTHIC repos
```

### Working with Packages
```bash
# Update all submodules to latest
npm run update-submodules

# Work on a specific package
cd packages/prompt-toolkit
npm test
npm run build

# Commit changes in submodule
git add .
git commit -m "feat: add new template function"
git push

# Update submodule reference in meta repo
cd ../..
git add packages/prompt-toolkit
git commit -m "chore: update prompt-toolkit submodule"
```

## 🏗️ Architecture Patterns

### Meta Repository Pattern
The metaGOTHIC framework uses a meta repository pattern with Git submodules:
- **Meta Repository**: Orchestrates all metaGOTHIC packages
- **Package Repositories**: Each package in its own GitHub repository
- **Benefits**: Independent versioning, clear ownership, automated publishing

### UI Architecture
- **React + TypeScript**: Type-safe component development
- **TanStack Query**: Efficient data fetching and caching
- **Tailwind CSS**: Utility-first styling with dark mode support
- **Vite**: Fast development and optimized builds

### API Integration (Future)
The dashboard currently uses mock data. Future integration will:
- Connect to GitHub API for real-time repository data
- Use GitHub Actions API for workflow management
- Implement WebSocket connections for live updates
- Add authentication for secure operations

## 📊 Monitoring Capabilities

### Health Metrics Tracked
- **Build Status**: Pass/fail status of latest builds
- **Test Coverage**: Percentage and trends
- **Dependency Health**: Outdated or vulnerable dependencies
- **Activity**: Recent commits, PRs, and issues
- **Performance**: Build times and bundle sizes

### Pipeline Control Features
- **Trigger Workflows**: Start tests, builds, or deployments
- **Cancel Operations**: Stop running workflows
- **Publish Packages**: Version, tag, and publish to npm
- **Batch Operations**: Perform actions across multiple packages

## 🔐 Security Considerations

### Authentication (To Be Implemented)
- GitHub OAuth for user authentication
- PAT tokens for API operations
- Role-based access control for sensitive operations

### Best Practices
- Never commit secrets or tokens
- Use environment variables for configuration
- Implement rate limiting for API calls
- Audit log all pipeline operations

## 📈 Future Enhancements

### Phase 1: MVP (Current)
- ✅ Basic health monitoring dashboard
- ✅ Pipeline control interface
- ✅ Mock data integration
- ⏳ Package creation within UI

### Phase 2: API Integration
- [ ] GitHub API connection
- [ ] Real-time data updates
- [ ] Authentication system
- [ ] Webhook integration

### Phase 3: Advanced Features
- [ ] Performance analytics
- [ ] Dependency graph visualization
- [ ] Automated issue creation
- [ ] Integration with Claude for AI assistance

## 🤖 AI/Claude Development Guidelines

### Working Within metaGOTHIC Context

When Claude is asked to work on metaGOTHIC:

1. **Focus on Framework**: This is an AI-guided development framework, not a visa analysis system
2. **Embrace Dogfooding**: Use metaGOTHIC tools to develop metaGOTHIC itself
3. **Prioritize Current Work**: Check `/docs/backlog.md` for current priorities
4. **Fix Before Feature**: Address the Tools page ThemeContext issue before new features

### Context Loading Strategy

Load context progressively based on the task:

1. **Overview**: Start with this CLAUDE.md for framework understanding
2. **Current Priority**: Load `/docs/backlog.md` to see what's most important
3. **Package Work**: Load specific package CLAUDE.md and source files
4. **Architecture**: Load relevant ADRs from `/docs/ADR-*.md`

### Quick Commands for Claude
- "What's the current priority?" → Check backlog.md and Tools page issue
- "Show metaGOTHIC health" → Load dashboard components
- "Fix Tools page" → Focus on ThemeContext error in ui-components
- "Update package X" → Load package submodule
- "Add metaGOTHIC feature" → Check backlog first, then architecture docs

### Development Principles
1. **Framework First**: All work should advance the metaGOTHIC framework
2. **Real Integration**: Prefer real implementations over mocks
3. **User Experience**: Ensure smooth developer experience
4. **Self-Testing**: Test features by using them on metaGOTHIC itself

## 🚦 Status Indicators

### Package Health Status
- 🟢 **Healthy**: All checks passing, up-to-date
- 🟡 **Warning**: Minor issues, outdated dependencies
- 🔴 **Critical**: Build failures, security issues

### Pipeline Status
- ⏸️ **Queued**: Waiting to start
- 🔄 **In Progress**: Currently running
- ✅ **Success**: Completed successfully
- ❌ **Failed**: Completed with errors
- ⏹️ **Cancelled**: Manually stopped

## 📝 Development Guidelines

### For UI Components
- Use TypeScript strict mode
- Follow React best practices
- Implement error boundaries
- Add loading states for all async operations
- Use semantic HTML and ARIA labels

### For Package Management
- Keep submodules up-to-date
- Version packages semantically
- Document all public APIs
- Maintain high test coverage
- Update CLAUDE.md with changes

## 🚨 Current Priority: Tools Page ThemeContext Fix

**IMMEDIATE TASK**: The Tools page at `/tools` has a runtime error due to missing ThemeContext.

### Issue Details
- **Error**: Components import `ThemeContext` that doesn't exist
- **Location**: `/packages/ui-components/src/pages/Tools.tsx` and related components
- **Impact**: Tools page crashes on load preventing repository management features

### Fix Options
1. **Quick Fix**: Remove theme imports from Tools components
2. **Proper Fix**: Create ThemeContext provider with dark/light mode support
3. **Best Fix**: Integrate with existing Tailwind dark mode classes

The Tools page implements critical features for the dogfooding principle:
- Uncommitted changes analysis across all repos
- AI-powered commit message generation
- Automated git operations
- Real-time repository status monitoring

## 🐕 Dogfooding Principle

metaGOTHIC follows the dogfooding principle - we use our own framework to develop the framework itself:

### What This Means
1. **Self-Development**: metaGOTHIC tools are used to develop metaGOTHIC
2. **Real-world Testing**: Every feature is battle-tested by our own use
3. **Continuous Improvement**: Pain points are immediately addressed
4. **Authenticity**: We experience what our users experience

### Current Dogfooding Features
- **UI Dashboard**: Monitor metaGOTHIC package health
- **Pipeline Control**: Manage our own CI/CD workflows
- **Tools Page**: Automate our own git operations
- **AI Integration**: Use Claude to help develop Claude integration

### Benefits
- Immediate feedback on tool effectiveness
- Natural prioritization of important features
- Authentic understanding of developer needs
- Rapid iteration based on real usage