# Commit Message Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for automatic semantic versioning.

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

- **feat**: A new feature (triggers MINOR version bump)
- **fix**: A bug fix (triggers PATCH version bump)
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

## Breaking Changes

Add `BREAKING CHANGE:` in the footer or `!` after the type to trigger a MAJOR version bump:

```
feat!: remove deprecated API
```

or

```
feat: add new authentication system

BREAKING CHANGE: The old auth API has been removed
```

## Examples

```bash
# Patch release (0.1.0 → 0.1.1)
git commit -m "fix: resolve memory leak in Lua execution"

# Minor release (0.1.0 → 0.2.0)
git commit -m "feat: add new component system"

# Major release (0.1.0 → 1.0.0)
git commit -m "feat!: redesign core API"
```

## Automatic Versioning

When you push to the main/master branch:

- Semantic-release analyzes your commit messages
- Automatically determines the version bump
- Updates package.json and CHANGELOG.md
- Creates a GitHub release
- Publishes to npm
