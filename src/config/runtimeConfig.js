import { importMetaDashboardEnv, resolveDashboardConfig } from './dashboardConfig.js';

let cachedConfig;

export function getDashboardRuntimeConfig() {
  if (!cachedConfig) {
    cachedConfig = resolveDashboardConfig(importMetaDashboardEnv(import.meta.env), {
      isProduction: import.meta.env.PROD,
    });
  }
  return cachedConfig;
}

export function resetDashboardRuntimeConfigForTests() {
  cachedConfig = undefined;
}
