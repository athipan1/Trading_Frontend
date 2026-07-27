import { DATA_SOURCES } from '../config/dashboardConfig.js';
import { getDashboardRuntimeConfig } from '../config/runtimeConfig.js';

const REQUEST_TIMEOUT_MS = 30_000;

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function requestJson(path, { method = 'GET', body, operatorToken, fetchImpl = globalThis.fetch } = {}) {
  const config = getDashboardRuntimeConfig();
  if (config.dataSource !== DATA_SOURCES.MANAGER_API) {
    throw new Error('คำสั่งควบคุมต้องใช้ VITE_DATA_SOURCE=manager-api');
  }
  if (!operatorToken) {
    throw new Error('กรุณาใส่ Operator Token ก่อนเชื่อมต่อ Manager_Agent');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(joinUrl(config.managerApiUrl, path), {
      method,
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Operator-Token': operatorToken,
        'X-Correlation-ID': crypto.randomUUID(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Manager_Agent ตอบกลับไม่ใช่ JSON (HTTP ${response.status})`);
    }
    if (!response.ok) {
      throw new Error(payload?.detail || payload?.error?.message || `Manager_Agent HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function getControlCapabilities(operatorToken) {
  return requestJson('/web-control/capabilities', { operatorToken });
}

export function askFinancialAdvisor({ operatorToken, accountId, entries, availableInvestmentCapital, message }) {
  return requestJson('/web-control/financial-advisor', {
    method: 'POST',
    operatorToken,
    body: {
      account_id: accountId,
      entries,
      available_investment_capital: availableInvestmentCapital,
      message,
    },
  });
}

export function createInvestmentPlan({
  operatorToken,
  accountId,
  ticker,
  period = '1mo',
  userGoal,
  maxInvestmentAmount,
}) {
  return requestJson('/web-control/investment-plans', {
    method: 'POST',
    operatorToken,
    body: {
      account_id: accountId,
      ticker,
      period,
      user_goal: userGoal,
      max_investment_amount: maxInvestmentAmount,
    },
  });
}

export function getInvestmentPlan({ operatorToken, tradePlanId }) {
  return requestJson(`/web-control/investment-plans/${encodeURIComponent(tradePlanId)}`, { operatorToken });
}

export function confirmInvestmentPlan({ operatorToken, accountId, tradePlanId, confirmationText }) {
  return requestJson(`/web-control/investment-plans/${encodeURIComponent(tradePlanId)}/confirm`, {
    method: 'POST',
    operatorToken,
    body: {
      account_id: accountId,
      confirmation_text: confirmationText,
    },
  });
}
