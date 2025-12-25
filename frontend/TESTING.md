# Testing Guide

## Overview
This document describes the testing setup for the Compliance Execution System frontend.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests in CI mode (single run, no watch)
```bash
CI=true npm test
```

## Test Structure

### Unit Tests
Located alongside component files with `.test.js` extension.

**Current Test Coverage:**
- `ErrorBoundary.test.js` - Error boundary component tests
- `AuthContext.test.js` - Authentication context tests

### Testing Libraries
- **@testing-library/react** - Component testing utilities
- **@testing-library/jest-dom** - Custom DOM matchers
- **@testing-library/user-event** - User interaction simulation
- **Jest** - Test runner and assertion library

## Writing Tests

### Component Test Example
```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders component correctly', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Context Test Example
```javascript
import { renderHook } from '@testing-library/react';
import { useAuth, AuthProvider } from './AuthContext';

test('provides auth context', () => {
  const { result } = renderHook(() => useAuth(), {
    wrapper: AuthProvider
  });
  expect(result.current.user).toBeDefined();
});
```

## Critical Test Areas

### 1. Error Boundaries
Tests ensure the app doesn't crash on errors and displays fallback UI.

### 2. Authentication
Tests verify login, logout, token handling, and auth state management.

### 3. Enforcement Logic (TODO)
Future tests should verify:
- Obligation immutability (can't edit SLA after creation)
- Evidence submission deadlines
- Audit log triggers

## Coverage Goals

Minimum coverage thresholds:
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

**Critical paths should have 80%+ coverage:**
- Authentication flows
- Obligation creation/editing
- Evidence upload
- SLA enforcement

## Mocking Guidelines

### API Calls
```javascript
jest.mock('axios');
axios.get.mockResolvedValue({ data: {...} });
```

### Local Storage
```javascript
localStorage.setItem('token', 'fake-token');
```

### Router Navigation
```javascript
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));
```

## Production Testing Checklist

Before NBFC production deployment, ensure:
- [ ] All authentication flows tested
- [ ] Error boundary tests passing
- [ ] Obligation creation/edit enforcement verified
- [ ] Evidence upload validation tested
- [ ] SLA deadline enforcement confirmed
- [ ] Audit log triggers verified
- [ ] Role-based access control tested
- [ ] API error handling covered
- [ ] Loading states tested
- [ ] Form validation tested

## Integration Testing (Future)

For full integration testing:
1. Use Cypress or Playwright for E2E tests
2. Test against staging backend
3. Verify database triggers fire correctly
4. Test full compliance workflows

## Testing Best Practices

1. **Test user behavior, not implementation**
   - Focus on what users see and do
   - Avoid testing internal state

2. **Use semantic queries**
   - Prefer `getByRole`, `getByLabelText`, `getByText`
   - Avoid `getByTestId` unless necessary

3. **Test accessibility**
   - Ensure interactive elements are keyboard accessible
   - Verify ARIA labels are present

4. **Keep tests isolated**
   - Each test should be independent
   - Use `beforeEach` to reset state

5. **Test error states**
   - Verify error messages display
   - Ensure graceful degradation

## Continuous Integration

### GitHub Actions Example
```yaml
- name: Run tests
  run: npm test -- --coverage --watchAll=false
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## References
- [React Testing Library Docs](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
