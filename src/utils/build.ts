export const isBuildOne = import.meta.env.VITE_CURRENT_BUILD === '1.0';

const _buildVersion = parseFloat(import.meta.env.VITE_CURRENT_BUILD ?? '0');
export const isBuildOneOrAbove = _buildVersion >= 1.0;

export const COMING_SOON_ROUTES = [
  '/dashboard/otp-alerts',
  '/dashboard/patterns',
  '/dashboard/heatmaps',
];
