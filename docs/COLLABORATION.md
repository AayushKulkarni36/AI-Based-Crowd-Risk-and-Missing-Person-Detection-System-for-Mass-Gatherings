# Team Collaboration Guide

This guide outlines the Git workflow, coding standards, and collaboration practices for the project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Git Workflow](#git-workflow)
3. [Branch Naming Conventions](#branch-naming-conventions)
4. [Commit Message Format](#commit-message-format)
5. [Code Review Process](#code-review-process)
6. [Best Practices](#best-practices)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/AayushKulkarni36/AI-Based-Crowd-Risk-and-Missing-Person-Detection-System-for-Mass-Gatherings.git
cd AI-Based-Crowd-Risk-and-Missing-Person-Detection-System-for-Mass-Gatherings
```

### 2. Set Up Your Development Environment

Follow the instructions in [TEAM_SETUP.md](../TEAM_SETUP.md) to set up your local development environment.

### 3. Configure Git (if not already done)

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## Git Workflow

### Standard Workflow

1. **Pull Latest Changes**
   ```bash
   git pull origin main
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Write code
   - Test your changes
   - Commit frequently with meaningful messages

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: Add new feature description"
   ```

5. **Push to Remote**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Go to GitHub repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out PR description
   - Request review from team members

7. **After PR Approval**
   - Merge the PR (or ask maintainer to merge)
   - Delete the feature branch
   - Pull latest changes:
     ```bash
     git checkout main
     git pull origin main
     ```

### Workflow Diagram

```
main branch (production-ready)
    │
    ├── feature/new-dashboard (feature branch)
    │   └── commits...
    │
    ├── feature/api-improvements (feature branch)
    │   └── commits...
    │
    └── bugfix/login-error (bugfix branch)
        └── commits...
```

---

## Branch Naming Conventions

Use descriptive branch names with prefixes:

### Prefixes

- `feature/` - New features
  - Example: `feature/real-time-alerts`
  - Example: `feature/user-authentication`

- `bugfix/` - Bug fixes
  - Example: `bugfix/video-upload-error`
  - Example: `bugfix/database-connection-timeout`

- `hotfix/` - Critical production fixes
  - Example: `hotfix/security-patch`
  - Example: `hotfix/memory-leak`

- `refactor/` - Code refactoring
  - Example: `refactor/api-structure`
  - Example: `refactor/database-queries`

- `docs/` - Documentation updates
  - Example: `docs/update-readme`
  - Example: `docs/api-documentation`

- `test/` - Adding or updating tests
  - Example: `test/unit-tests-backend`
  - Example: `test/integration-tests`

### Branch Name Format

```
<prefix>/<short-description>
```

**Good Examples:**
- `feature/crowd-density-alerts`
- `bugfix/video-processing-error`
- `refactor/database-connection-pool`

**Bad Examples:**
- `new-feature` (missing prefix)
- `fix` (too vague)
- `feature/my-changes` (not descriptive)

---

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks (dependencies, build, etc.)
- `perf` - Performance improvements
- `ci` - CI/CD changes

### Scope (Optional)

The scope indicates the area of the codebase:
- `frontend` - Frontend changes
- `backend` - Backend changes
- `api` - API changes
- `database` - Database changes
- `ai` - AI/ML model changes
- `config` - Configuration changes

### Examples

**Simple commit:**
```
feat: Add video upload functionality
```

**Commit with scope:**
```
feat(backend): Add video processing endpoint
```

**Detailed commit:**
```
feat(frontend): Add real-time statistics dashboard

- Implemented Recharts for data visualization
- Added live updates via WebSocket
- Created responsive layout with Tailwind CSS

Closes #123
```

**Bug fix:**
```
fix(backend): Resolve database connection timeout

- Increased connection pool size
- Added retry logic for failed connections
- Improved error handling

Fixes #456
```

**Breaking change:**
```
feat(api): Redesign video upload endpoint

BREAKING CHANGE: Video upload endpoint now requires authentication token
```

### Commit Message Guidelines

1. **Use imperative mood**: "Add feature" not "Added feature" or "Adds feature"
2. **Keep subject line under 50 characters**
3. **Capitalize first letter of subject**
4. **No period at end of subject**
5. **Use body to explain what and why, not how**
6. **Reference issues/PRs in footer**

---

## Code Review Process

### Before Submitting PR

1. **Self-Review**
   - Review your own code
   - Test all functionality
   - Check for typos and formatting
   - Ensure no console.logs or debug code

2. **Run Tests** (if available)
   ```bash
   # Backend tests
   cd backend && npm test
   
   # Python tests
   python -m pytest tests/
   ```

3. **Check Linting**
   ```bash
   # Frontend
   cd frontend && npm run lint
   
   # Backend
   cd backend && npm run lint
   ```

### Creating Pull Request

1. **PR Title**: Use same format as commit messages
   ```
   feat(frontend): Add user authentication
   ```

2. **PR Description Template:**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Tested locally
   - [ ] All tests pass
   - [ ] Manual testing completed
   
   ## Screenshots (if applicable)
   [Add screenshots here]
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Comments added for complex code
   - [ ] Documentation updated
   - [ ] No new warnings generated
   ```

### Review Process

1. **Request Review**
   - Assign at least one reviewer
   - Add relevant labels
   - Link related issues

2. **Respond to Feedback**
   - Address all comments
   - Make requested changes
   - Push updates to same branch

3. **After Approval**
   - Squash commits if requested
   - Merge PR (or ask maintainer)
   - Delete branch after merge

### Review Guidelines

**As a Reviewer:**
- Be constructive and respectful
- Focus on code quality, not personal preferences
- Ask questions if something is unclear
- Approve when satisfied

**What to Review:**
- Code correctness and logic
- Code style and consistency
- Performance implications
- Security concerns
- Test coverage
- Documentation updates

---

## Best Practices

### Code Quality

1. **Write Clean Code**
   - Use meaningful variable names
   - Keep functions small and focused
   - Add comments for complex logic
   - Follow language-specific style guides

2. **Error Handling**
   - Always handle errors appropriately
   - Provide meaningful error messages
   - Log errors for debugging

3. **Performance**
   - Optimize database queries
   - Avoid unnecessary API calls
   - Use efficient algorithms
   - Profile before optimizing

### Git Best Practices

1. **Commit Often**
   - Small, logical commits
   - One feature/fix per commit
   - Don't commit broken code

2. **Keep Branches Updated**
   ```bash
   # Regularly sync with main
   git checkout main
   git pull origin main
   git checkout your-branch
   git merge main
   ```

3. **Use .gitignore**
   - Never commit sensitive data
   - Don't commit build artifacts
   - Don't commit dependencies

4. **Write Good Commit Messages**
   - Clear and descriptive
   - Explain why, not just what
   - Reference issues when applicable

### Communication

1. **Update Team**
   - Communicate blockers early
   - Share progress regularly
   - Ask for help when needed

2. **Documentation**
   - Update README for major changes
   - Document complex functions
   - Keep API documentation current

3. **Issue Management**
   - Create issues for bugs
   - Use labels appropriately
   - Close issues when resolved

---

## Conflict Resolution

### When Conflicts Occur

1. **Pull Latest Changes**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Rebase Your Branch**
   ```bash
   git checkout your-branch
   git rebase main
   ```

3. **Resolve Conflicts**
   - Git will mark conflicts
   - Edit files to resolve
   - Remove conflict markers
   - Test your changes

4. **Continue Rebase**
   ```bash
   git add .
   git rebase --continue
   ```

5. **Force Push** (if needed)
   ```bash
   git push origin your-branch --force-with-lease
   ```

---

## Resources

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Code Review Guidelines](https://google.github.io/eng-practices/review/)

---

**Questions?** Open an issue or contact the project maintainer.

