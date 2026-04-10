// ============================================
// SETUPTEST.TS
// ============================================
// Jest testing setup

import '@testing-library/jest-dom';

// Mock window.location
declare global {
  interface Window {
    location: Location;
  }
}

const mockLocation = {
  href: '',
  reload: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn(),
  origin: '',
  protocol: '',
  host: '',
  hostname: '',
  port: '',
  pathname: '',
  search: '',
  hash: '',
  ancestorOrigins: {} as DOMStringList,
  toString: () => ''
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value ? value.toString() : '';
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});
