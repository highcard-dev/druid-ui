# Commit Message Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for clear commit history.

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

## Examples

```bash
git commit -m "fix: resolve memory leak in Lua execution"
git commit -m "feat: add new component system"
git commit -m "feat!: redesign core API"
```

## Versioning with Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and releases.

### Adding a Changeset

When you make a change that should be released, run:

```bash
npm run changeset
```

This will prompt you to:

1. Select which packages have changed
2. Choose the type of version bump (patch, minor, major)
3. Write a summary of the changes

A changeset file will be created in the `.changeset` directory.

### Release Process

When changesets are merged to main:

1. A "Version Packages" PR is automatically created/updated
2. This PR updates package versions and CHANGELOG files
3. When the PR is merged, packages are published to npm
4. GitHub releases are created automatically

### Version Bump Guidelines

- **patch** (0.0.x): Bug fixes, documentation updates
- **minor** (0.x.0): New features, non-breaking changes
- **major** (x.0.0): Breaking changes
