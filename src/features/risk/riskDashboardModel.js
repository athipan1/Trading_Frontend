const RISK_LEVEL_ALIASES = Object.freeze({
  low: 'low',
  normal: 'low',
  moderate: 'moderate',
  medium: 'moderate',
  elevated: 'high',
  high: 'high',
  severe: 'critical',
  critical: 'critical',
});

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedRiskLevel(value) {
  return RISK_LEVEL_ALIASES[String(value || '').trim().toLowerCase()] || 'unavailable';
}

function positionSectorAllocations(positions) {
  const sectorValues = new Map();
  positions.forEach((position) => {
    const sector = String(position?.sector || '').trim();
    const marketValue = finiteNumberOrNull(position?.marketValue);
    if (!sector || marketValue === null) return;
    sectorValues.set(sector, (sectorValues.get(sector) || 0) + Math.abs(marketValue));
  });
  const total = [...sectorValues.values()].reduce((sum, value) => sum + value, 0);
  return [...sectorValues.entries()]
    .map(([sector, marketValue]) => ({
      sector,
      marketValue,
      percent: total > 0 ? (marketValue / total) * 100 : 0,
      source: 'positions',
    }))
    .sort((left, right) => right.percent - left.percent);
}

function publishedSectorAllocations(allocations) {
  if (!Array.isArray(allocations) || allocations.length === 0) return [];
  const totalMarketValue = allocations.reduce(
    (sum, allocation) => sum + Math.abs(finiteNumberOrNull(allocation.marketValue) || 0),
    0,
  );
  return allocations
    .map((allocation) => {
      const marketValue = finiteNumberOrNull(allocation.marketValue);
      const publishedPercent = finiteNumberOrNull(allocation.percent);
      return {
        sector: allocation.sector,
        marketValue,
        percent: publishedPercent ?? (
          totalMarketValue > 0 && marketValue !== null
            ? (Math.abs(marketValue) / totalMarketValue) * 100
            : null
        ),
        source: 'manager',
      };
    })
    .filter((allocation) => allocation.percent !== null)
    .sort((left, right) => right.percent - left.percent);
}

export function deriveRiskDashboard(snapshot = {}) {
  const positions = Array.isArray(snapshot.positions) ? snapshot.positions : [];
  const risk = snapshot.risk || null;
  const valuesMasked = Boolean(
    snapshot.account?.valuesMasked
      || snapshot.privacy?.valuesMasked
      || positions.some((position) => position?.valuesMasked),
  );
  const visiblePositions = valuesMasked
    ? []
    : positions.filter((position) => finiteNumberOrNull(position?.marketValue) !== null);
  const equity = valuesMasked ? null : finiteNumberOrNull(snapshot.account?.equity);
  const grossExposureValue = visiblePositions.reduce(
    (sum, position) => sum + Math.abs(finiteNumberOrNull(position.marketValue) || 0),
    0,
  );
  const netExposureValue = visiblePositions.reduce(
    (sum, position) => sum + (finiteNumberOrNull(position.marketValue) || 0),
    0,
  );
  const calculatedGrossPercent = equity && equity > 0 ? (grossExposureValue / equity) * 100 : null;
  const calculatedNetPercent = equity && equity > 0 ? (netExposureValue / equity) * 100 : null;
  const grossExposurePercent = finiteNumberOrNull(risk?.grossExposurePercent)
    ?? calculatedGrossPercent;
  const netExposurePercent = finiteNumberOrNull(risk?.netExposurePercent)
    ?? calculatedNetPercent;
  const publishedAllocation = publishedSectorAllocations(risk?.sectorAllocation);
  const sectorAllocation = publishedAllocation.length
    ? publishedAllocation
    : positionSectorAllocations(visiblePositions);
  const protectedCount = positions.filter((position) => (
    position?.protection?.hasBracket
      || (position?.protection?.hasStopLoss && position?.protection?.hasTakeProfit)
  )).length;
  const emergencyPublished = Boolean(risk?.emergencyHalt);
  const emergencyActive = emergencyPublished ? risk.emergencyHalt.active : null;
  const explicitRiskLevel = normalizedRiskLevel(risk?.riskLevel);
  const riskLevel = emergencyActive === true ? 'critical' : explicitRiskLevel;
  const grossLimitPercent = finiteNumberOrNull(risk?.limits?.grossExposurePercent);
  const drawdownLimitPercent = finiteNumberOrNull(risk?.limits?.drawdownPercent);
  const drawdownPercent = finiteNumberOrNull(risk?.drawdownPercent);
  const riskScore = finiteNumberOrNull(risk?.riskScore);
  const riskPhase = Array.isArray(snapshot.phases)
    ? snapshot.phases.find((phase) => String(phase?.name).toLowerCase() === 'risk') || null
    : null;

  return {
    valuesMasked,
    riskTelemetryPublished: Boolean(risk),
    grossExposureValue: valuesMasked ? null : grossExposureValue,
    netExposureValue: valuesMasked ? null : netExposureValue,
    grossExposurePercent,
    netExposurePercent,
    exposureSource: finiteNumberOrNull(risk?.grossExposurePercent) !== null
      ? 'manager'
      : calculatedGrossPercent !== null ? 'calculated' : 'unavailable',
    drawdownPercent,
    riskScore,
    riskLevel,
    sectorAllocation,
    sectorSource: publishedAllocation.length ? 'manager' : sectorAllocation.length ? 'positions' : 'unavailable',
    protection: {
      protectedCount,
      totalCount: positions.length,
      percent: positions.length ? (protectedCount / positions.length) * 100 : null,
    },
    emergencyHalt: {
      published: emergencyPublished,
      active: emergencyActive,
      reason: risk?.emergencyHalt?.reason || null,
      updatedAt: risk?.emergencyHalt?.updatedAt || null,
    },
    limits: {
      grossExposurePercent: grossLimitPercent,
      drawdownPercent: drawdownLimitPercent,
      grossUtilization: grossLimitPercent && grossExposurePercent !== null
        ? (grossExposurePercent / grossLimitPercent) * 100
        : null,
      drawdownUtilization: drawdownLimitPercent && drawdownPercent !== null
        ? (drawdownPercent / drawdownLimitPercent) * 100
        : null,
    },
    riskPhase,
  };
}
