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
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});
