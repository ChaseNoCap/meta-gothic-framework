# metaGOTHIC Framework

AI-Guided Opinionated TypeScript Framework with High Intelligent Components

## 🚀 Overview

metaGOTHIC is a nested meta repository within the h1b-visa-analysis project, consolidating all metaGOTHIC-specific packages for AI-assisted development workflows. It features a comprehensive health monitoring dashboard and CI/CD control center.

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@chasenocap/claude-client` | Claude CLI subprocess wrapper with streaming | ✅ Published |
| `@chasenocap/prompt-toolkit` | XML template system for structured prompts | ✅ Published |
| `@chasenocap/sdlc-config` | YAML-based SDLC configuration management | ✅ Published |
| `@chasenocap/sdlc-engine` | State machine for SDLC phase management | ✅ Published |
| `@chasenocap/sdlc-content` | Templates and knowledge base | ✅ Published |
| `@chasenocap/graphql-toolkit` | GraphQL utilities and schema management | ✅ Published |
| `@chasenocap/context-aggregator` | Intelligent context management for AI | ✅ Published |
| `@chasenocap/ui-components` | React dashboard components | 🚧 In Progress |

## 🖥️ Dashboard Features

### Health Monitoring
- Real-time package health status
- Build and test results
- Test coverage metrics
- Dependency health tracking
- Recent workflow activity

### Pipeline Control
- Trigger workflows with one click
- Publish packages with version control
- Monitor running pipelines
- Cancel or retry operations

## 🛠️ Quick Start

```bash
# Clone with submodules
git clone --recurse-submodules <repo-url>
cd h1b-visa-analysis/metaGOTHIC

# Install dependencies
npm install

# Start the dashboard
npm run dev
```

The dashboard will be available at http://localhost:3001

## 📚 Documentation

- **Context Loading**: See `/metaGOTHIC/CLAUDE.md` for AI context
- **Package Details**: Each package has its own CLAUDE.md file
- **Architecture**: Follows the metaGOTHIC pattern architecture

## 🔧 Development

### Working with Packages

```bash
# Update all submodules
npm run update-submodules

# Work on a specific package
cd packages/prompt-toolkit
npm test
npm run build
```

### Adding New Features

1. Create feature branch in the specific package submodule
2. Implement and test locally
3. Push to package repository
4. Update submodule reference in meta repository

## 🏗️ Architecture

This is a nested meta repository pattern:
- **Parent**: h1b-visa-analysis (main project)
- **Child**: metaGOTHIC (this repository)
- **Grandchildren**: Individual package repositories

## 🤝 Contributing

1. Follow the decomposition principles
2. Maintain package boundaries
3. Keep CLAUDE.md files updated
4. Ensure high test coverage
5. Use semantic versioning

## 📄 License

MIT - See individual package licenses for details