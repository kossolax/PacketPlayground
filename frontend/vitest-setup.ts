import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { UserPrivileges, UserType } from '@/lib/authenticate';

// Mock the ResizeObserver
global.ResizeObserver = class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(() => ({
  width: 500,
  height: 300,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  x: 0,
  y: 0,
  toJSON: vi.fn(),
}));

// Mock window.matchMedia
export const mockAddEventListener = vi.fn();
export const mockRemoveEventListener = vi.fn();

Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    dispatchEvent: vi.fn(),
  })),
  writable: true,
});

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

// Mock useQuery
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    }),
    useMutation: vi.fn().mockReturnValue({
      mutateAsync: vi.fn(),
    }),
    useQueryClient: vi.fn().mockReturnValue({
      cancelQueries: vi.fn(),
      getQueryData: vi.fn().mockReturnValue(undefined),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    }),
  };
});

// Mock Number.prototype.toLocaleString
const forcedLocale = 'en-US';
const numberFormatter = new Intl.NumberFormat(forcedLocale);
vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(
  function toLocaleStringMock(this: number) {
    return numberFormatter.format(this);
  }
);

// Mock window.location
let href = 'http://example.com';
let protocol = 'http:';
Object.defineProperty(window, 'location', {
  value: {
    get href() {
      return href;
    },
    set href(newHref: string) {
      href = newHref;
      protocol = new URL(newHref).protocol;
    },
    get protocol() {
      return protocol;
    },
    get hostname() {
      return new URL(href).hostname;
    },
  },
  writable: true,
});

// Mock pointer events
class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(type: string, props: PointerEventInit) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || 'mouse';
  }
}

window.PointerEvent = MockPointerEvent as any;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

// Mock the auth context
vi.mock('@/providers/auth-context', () => ({
  useAuth: () => ({
    user: {
      user: 'Administrator',
      privileges: UserPrivileges.Administrator,
    } as UserType,
    isAuthenticated: true,
    isLoading: false,
    sessionId: 'test-session-id',
  }),
}));

// Mock the i18n context
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

// Mock the toast
vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});
