function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function deriveDashboardInsights(snapshot) {
  const positions = Array.isArray(snapshot?.positions) ? snapshot.positions : [];
  const valuesMasked = Boolean(
    snapshot?.account?.valuesMasked
      || snapshot?.privacy?.valuesMasked
      || positions.some((position) => position?.valuesMasked),
  );
  const visiblePositions = valuesMasked
    ? []
    : positions.filter((position) => Math.abs(finiteNumber(position.marketValue)) > 0);
  const totalMarketValue = visiblePositions.reduce(
    (sum, position) => sum + Math.abs(finiteNumber(position.marketValue)),
    0,
  );
  const allocations = visiblePositions
    .map((position) => ({
      symbol: position.symbol,
      marketValue: finiteNumber(position.marketValue),
      share: totalMarketValue > 0
        ? Math.abs(finiteNumber(position.marketValue)) / totalMarketValue
        : 0,
    }))
    .sort((left, right) => Math.abs(right.marketValue) - Math.abs(left.marketValue))
    .slice(0, 5);
  const unrealizedPnL = valuesMasked
    ? null
    : positions.reduce((sum, position) => sum + finiteNumber(position.unrealizedPnL), 0);
  const recentPhases = Array.isArray(snapshot?.phases)
    ? snapshot.phases.slice(-4).reverse()
    : [];
  const liveTradingEnabled = snapshot?.runtime?.liveTradingEnabled;
  const safetyState = liveTradingEnabled === false
    ? 'safe'
    : liveTradingEnabled === true ? 'critical' : 'unknown';

  return {
    allocations,
    recentPhases,
    totalMarketValue,
    unrealizedPnL,
    valuesMasked,
    safetyState,
    workflowConclusion: snapshot?.workflow?.conclusion || 'unknown',
  };
}
