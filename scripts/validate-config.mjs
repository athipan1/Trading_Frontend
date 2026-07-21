import { loadEnv } from 'vite';
import { resolveDashboardConfig } from '../src/config/dashboardConfig.js';

const mode = process.env.NODE_ENV === 'test' ? 'test' : 'production';
const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

try {
  const config = resolveDashboardConfig(env, { isProduction: mode === 'production' });
  console.log(`Dashboard configuration valid: source=${config.dataSource}, refresh=${config.refreshIntervalMs}ms`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
