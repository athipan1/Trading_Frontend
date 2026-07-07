import { portfolioSnapshot } from '../data/mockPortfolio';

const API_BASE_URL = import.meta.env.VITE_MANAGER_API_URL;
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

export async function getDashboardSnapshot() {
  if (USE_MOCK_DATA || !API_BASE_URL) {
    return portfolioSnapshot;
  }

  const response = await fetch(`${API_BASE_URL}/dashboard/snapshot`);
  if (!response.ok) {
    throw new Error(`Dashboard snapshot request failed: ${response.status}`);
  }
  return response.json();
}
