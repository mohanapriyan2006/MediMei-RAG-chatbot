# Frontend Testing Guide

This document describes how to set up, run, and extend the test suite for the React + TypeScript + Vite frontend.

## Current State

The frontend does not yet have a test framework configured. The recommended stack below matches the existing Vite + React + TypeScript setup and adds minimal, well-supported testing tools.

## Recommended Test Framework

- **Vitest** — Vite-native test runner (drop-in replacement for Jest)
- **jsdom** — browser-like DOM environment for tests
- **@testing-library/react** — render and interact with React components
- **@testing-library/jest-dom** — custom DOM matchers (`toBeInTheDocument`, etc.)
- **@testing-library/user-event** — simulate user interactions

## Installation

From the `frontend/` directory, install the dev dependencies:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Configuration

### 1. Vitest config

Create or update `vite.config.ts` to expose a `test` field:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

### 2. Test setup file

Create `frontend/tests/setup.ts`:

```ts
// tests/setup.ts
import '@testing-library/jest-dom/vitest'
```

### 3. TypeScript types

Add the Vitest types to `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

### 4. NPM scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run"
  }
}
```

## Test Layout

Suggested folder structure under `frontend/`:

```
frontend/
├── src/
│   ├── components/
│   │   └── Button.tsx
│   ├── api/
│   │   └── auth.ts
│   └── contexts/
│       └── AuthContext.tsx
├── tests/
│   ├── setup.ts
│   ├── components/
│   │   └── Button.test.tsx
│   ├── api/
│   │   └── auth.test.ts
│   └── contexts/
│       └── AuthContext.test.tsx
```

Place test files next to the code they cover or in a top-level `tests/` mirror of `src/`. Use the pattern `*.test.{ts,tsx}`.

## Running Tests

```bash
# Run tests in watch mode (default)
npm run test

# Run tests once (CI mode)
npm run test:run

# Run tests in the Vitest UI
npm run test:ui

# Run a single file
npx vitest run tests/components/Button.test.tsx
```

## Writing a Component Test

```tsx
// tests/components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../src/components/Button'

describe('Button', () => {
  it('renders the label and responds to clicks', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Submit</Button>)

    const button = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

## Writing a Hook / Context Test

```tsx
// tests/contexts/AuthContext.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext'

function TestConsumer() {
  const { isAuthenticated } = useAuth()
  return <div>{isAuthenticated ? 'Logged in' : 'Logged out'}</div>
}

describe('AuthContext', () => {
  it('starts unauthenticated', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    expect(screen.getByText('Logged out')).toBeInTheDocument()
  })
})
```

## Writing an API Test

```ts
// tests/api/auth.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loginRequest } from '../../src/api/auth'

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'mock-token', token_type: 'bearer' }),
  } as Response)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loginRequest', () => {
  it('returns a token on success', async () => {
    const result = await loginRequest('user@example.com', 'password')
    expect(result.access_token).toBe('mock-token')
  })
})
```

## Mocking Strategy

- **API calls:** mock `globalThis.fetch` or the functions in `src/api/*`
- **React Router:** wrap components in `MemoryRouter` from `react-router-dom`
- **Heavy libraries:** use `vi.mock()` to replace `lucide-react` icons or `sonner` toasts

## CI / Automation

A minimal CI step for the frontend:

```bash
cd frontend
npm ci
npm run lint
npm run test:run
npm run build
```

## Notes

- Keep component tests focused on user-visible behavior rather than implementation details.
- Use `userEvent` over `fireEvent` for interactions that more closely match real user behavior.
- Add `data-testid` attributes only when text/role selectors are not practical.
