/**
 * Shared Non-Secret Configuration Constants for IntentFlow
 */

export const APP_CONFIG = {
  name: 'IntentFlow',
  version: '0.1.0-phase1',
  defaultPorts: {
    web: 3000,
    api: 4000,
  },
  apiEndpoints: {
    health: '/health',
  },
} as const;
