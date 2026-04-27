/**
 * user-context.ts
 * Персонализация и памет за user context
 */

import type { UserContext, UserPreferences, RoomType } from '../types';

/**
 * Default user context
 */
export const defaultUserContext: UserContext = {
  sessionId: '',
  visitCount: 0,
  firstVisit: Date.now(),
  lastVisit: Date.now(),
  viewedProducts: [],
  searchHistory: [],
  preferences: {
    budget: undefined,
    roomType: undefined,
    squareMeters: undefined,
    brandPreference: undefined,
    priority: 'price',
    timeline: 'planning',
  },
  consent: {
    given: false,
    timestamp: Date.now(),
    version: '1.0',
    dataTypes: [],
    analytics: false,
    storage: false,
    marketing: false,
  },
  device: {
    type: 'desktop',
    viewport: { width: 1920, height: 1080 },
    touch: false,
    language: 'bg',
  },
};

/**
 * Create new user context
 */
export function createUserContext(overrides?: Partial<UserContext>): UserContext {
  const sessionId = generateSessionId();
  return {
    ...defaultUserContext,
    sessionId,
    ...overrides,
  };
}

/**
 * Update user context with new data
 */
export function updateUserContext(
  current: UserContext,
  updates: Partial<UserContext>
): UserContext {
  return {
    ...current,
    ...updates,
    lastVisit: Date.now(),
  };
}

/**
 * Add product to viewed list
 */
export function addProductViewed(
  context: UserContext,
  productId: string
): UserContext {
  const viewedProducts = [...context.viewedProducts];
  if (!viewedProducts.includes(productId)) {
    viewedProducts.push(productId);
  }
  return {
    ...context,
    viewedProducts,
  };
}

/**
 * Add page to viewed list
 */
export function addPageViewed(
  context: UserContext,
  page: string
): UserContext {
  const searchHistory = [...context.searchHistory];
  if (!searchHistory.includes(page)) {
    searchHistory.push(page);
  }
  return {
    ...context,
    searchHistory,
  };
}

/**
 * Update user preferences
 */
export function updateUserPreferences(
  context: UserContext,
  preferences: Partial<UserPreferences>
): UserContext {
  return {
    ...context,
    preferences: {
      ...context.preferences,
      ...preferences,
    },
  };
}

/**
 * Get room type from context
 */
export function getUserRoomType(context: UserContext): RoomType | undefined {
  return context.preferences?.roomType;
}

/**
 * Get budget from context
 */
export function getUserBudget(context: UserContext): number | undefined {
  return context.preferences?.budget;
}

/**
 * Get square meters from context
 */
export function getUserSquareMeters(context: UserContext): number | undefined {
  return context.preferences?.squareMeters;
}

/**
 * Check if user is returning
 */
export function isReturningUser(context: UserContext): boolean {
  return context.visitCount > 1;
}

/**
 * Get last viewed products
 */
export function getLastViewedProducts(
  context: UserContext,
  limit: number = 5
): string[] {
  return context.viewedProducts.slice(-limit);
}

/**
 * Persist user context to localStorage
 */
export function persistUserContext(context: UserContext): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ai_user_context', JSON.stringify(context));
  }
}

/**
 * Load user context from localStorage
 */
export function loadUserContext(): UserContext | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('ai_user_context');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse user context', e);
      }
    }
  }
  return null;
}

/**
 * Clear user context from localStorage
 */
export function clearUserContext(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ai_user_context');
  }
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Track user activity
 */
export function trackUserActivity(
  context: UserContext,
  _activity: string
): UserContext {
  return {
    ...context,
  };
}

export default {
  createUserContext,
  updateUserContext,
  addProductViewed,
  addPageViewed,
  updateUserPreferences,
  getUserRoomType,
  getUserBudget,
  getUserSquareMeters,
  isReturningUser,
  getLastViewedProducts,
  persistUserContext,
  loadUserContext,
  clearUserContext,
  trackUserActivity,
};
