export const isBuildOne = import.meta.env.VITE_CURRENT_BUILD === '1.0';

const _buildVersion = parseFloat(import.meta.env.VITE_CURRENT_BUILD ?? '0');
export const isBuildOneOrAbove = _buildVersion >= 1.0;

// Set VITE_AI_FEATURES=false to disable and hide all AI features (Eureka assistant,
// companion glow, sidebar AI bubble, AI-analysable hover hints).
export const isAiEnabled = import.meta.env.VITE_AI_FEATURES !== 'false';

export const COMING_SOON_ROUTES = [
  '/dashboard/otp-alerts',
  '/dashboard/patterns',
  '/dashboard/heatmaps',
];
