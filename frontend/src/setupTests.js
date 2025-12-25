// ============================================
// SETUPTEST.JS
// ============================================
// Jest testing setup

import '@testing-library/jest-dom';

// Mock window.location
delete window.location;
window.location = { href: '', reload: jest.fn() };

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
