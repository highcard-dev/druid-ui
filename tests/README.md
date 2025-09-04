# Integration Tests for DruidUI

This directory contains comprehensive integration tests for the DruidUI library, covering all major components and functionality.

## Test Structure

### 1. **DruidUI Core Integration Tests** (`druid-ui.integration.test.ts`)

- Custom element registration and shadow DOM creation
- Attribute handling (entrypoint, CSS, style, profile, routing-strategy)
- File loading with different formats (Lua files, JSON bundles)
- Event dispatching and handling
- CSS variable management and colors property
- Hot reload functionality

### 2. **Utility Functions Tests** (`util.integration.test.ts`)

- `dfunc` function testing with various parameter combinations
- FENode creation and structure validation
- Component view method handling
- Complex nested structure support

### 3. **Routing Strategy Tests** (`routing-strategy.integration.test.ts`)

- HistoryRoutingStrategy browser integration
- CustomRoutingStrategy state management
- Factory function (`createRoutingStrategy`) validation
- Interface compatibility between strategies
- Edge cases and error handling

### 4. **File Loader Tests** (`file-loader.integration.test.ts`)

- HTTP file loading with various content types
- Error handling for different HTTP status codes
- URL handling (absolute, relative, with parameters)
- Performance testing with concurrent requests
- Edge cases (empty files, large content, special characters)

### 5. **End-to-End Integration Tests** (`end-to-end.integration.test.ts`)

- Complete application lifecycle testing
- Multi-component integration scenarios
- Error recovery and resilience testing
- Performance and memory management
- State consistency across operations

## Test Setup

The tests use Vitest with jsdom environment for DOM simulation. Key mocks include:

- **wasmoon**: Mocked Lua engine for testing Lua script loading
- **morphdom**: Mocked DOM diffing library
- **fetch**: Mocked for HTTP file loading tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The integration tests cover:

- ✅ **Custom Element Lifecycle**: Registration, attributes, shadow DOM
- ✅ **File Loading**: HTTP loader, JSON bundles, error handling
- ✅ **Routing**: History and custom strategies
- ✅ **Utility Functions**: DOM function creation and validation
- ✅ **Error Handling**: Network failures, malformed content, edge cases
- ✅ **Performance**: Concurrent operations, memory management
- ✅ **State Management**: Consistency across reloads and updates

## Mock Strategy

Tests use comprehensive mocking to:

- Isolate components under test
- Simulate external dependencies (Lua engine, DOM diffing)
- Control async operations (file loading, promise resolution)
- Test error conditions safely

## Key Testing Patterns

1. **Attribute-Driven Testing**: Validates how the component responds to different attribute combinations
2. **Async Operation Testing**: Ensures proper handling of file loading and Lua execution
3. **Error Boundary Testing**: Verifies graceful degradation when operations fail
4. **Integration Flow Testing**: Tests complete workflows from initialization to rendering
5. **Cross-Component Testing**: Validates interaction between different system components

## Best Practices

- Each test is isolated with proper setup/teardown
- Mocks are reset between tests to prevent interference
- Async operations use proper waiting mechanisms
- Error cases are tested as thoroughly as success cases
- Complex integration scenarios test realistic usage patterns
