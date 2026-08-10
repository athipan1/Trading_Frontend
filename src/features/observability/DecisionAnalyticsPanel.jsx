import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CircleAlert,
  Filter,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

const STAGE_LABELS = {
  scanner: ['Scanner', 'Scanner'],
  backtest: ['Backtest', 'Backtest'],
  market_regime: ['สภาวะตลาด', 'Market Regime'],
  portfolio: ['พอร์ต', 'Portfolio'],
  profit: ['กำไร', 'Profit'],
  risk: ['ความเสี่ยง', 'Risk'],
  execution: ['ส่งคำสั่ง', 'Execution'],
};

const ALERT_COPY = {
  emergency_halt_active: ['Emergency halt กำลังทำงาน', 'Emergency halt is active'],
  snapshot_stale: ['Snapshot เก่าเกินเกณฑ์', 'Snapshot is stale'],
  hourly_artifact_unavailable: ['ไม่มี hourly trading artifact ของรอบล่าสุด', 'Latest hourly trading artifact is unavailable'],
  consecutive_metadata_only_cycles: ['มี metadata-only cycles ต่อเนื่อง', 'Metadata-only cycles are repeating'],
  recent_execution_failure: ['พบ Execution failure ใน 6 รอบล่าสุด', 'Execution failure detected in the latest six cycles'],
  consecutive_no_backtest_progress: ['Candidate ไปไม่ถึง Backtest ต่อเนื่อง', 'Candidates are repeatedly not progressing through Backtest'],
  consecutive_risk_not_attempted: ['Risk ไม่ถูกเรียกต่อเนื่องทั้งที่มี Candidate', 'Risk is repeatedly not attempted despite available candidates'],
  high_risk_rejection_rate: ['Risk rejection rate สูง', 'Risk rejection rate is high'],
  insufficient_meaningful_history: ['ยังมี meaningful history ไม่พอสำหรับ trend เต็มรูปแบบ', 'Not enough meaningful history for a full trend comparison'],
};

const REASON_COPY = {
  investability_market_cap_below_minimum: ['Market cap ต่ำกว่าเกณฑ์', 'Market cap below minimum'],
  investability_average_dollar_volume_below_minimum: ['Dollar volume ต่ำกว่าเกณฑ์', 'Average dollar volume below minimum'],
  investability_spread_missing: ['ข้อมูล spread ไม่ครบ', 'Spread evidence unavailable'],
  new_entry_not_allowed: ['ไม่อนุญาตเปิด Position ใหม่', 'New entry not allowed'],
  bucket_conflict: ['Strategy bucket ขัดแย้ง', 'Strategy bucket conflict'],
  bucket_unassigned: ['ยังไม่มี Strategy bucket', 'Strategy bucket unassigned'],
  bucket_evidence_insufficient: ['หลักฐาน Strategy bucket ไม่พอ', 'Strategy bucket evidence insufficient'],
  evidence_gate_failed: ['Evidence gate ไม่ผ่าน', 'Evidence gate failed'],
  manager_verdict_hold: ['Manager ให้ HOLD', 'Manager verdict HOLD'],
  manager_verdict_sell: ['Manager ให้ SELL', 'Manager verdict SELL'],
  risk_rejected: ['Risk ปฏิเสธ', 'Risk rejected'],
  execution_failed: ['Execution ล้มเหลว', 'Execution failed'],
};

function localized(map, key, language) {
  const row = map[key];
  if (!row) return key || '—';
  return row[language === 'th' ? 0 : 1];
}

function percent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
}

function signedPoints(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} pp`;
}

function alertDetail(alert, language) {
  if (alert.code === 'snapshot_stale' && Number.isFinite(alert.value)) {
    return language === 'th'
      ? `อายุ ${alert.value.toFixed(0)} นาที · เกณฑ์ ${Number(alert.threshold || 0).toFixed(0)} นาที`
      : `Age ${alert.value.toFixed(0)} min · threshold ${Number(alert.threshold || 0).toFixed(0)} min`;
  }
  if (alert.code === 'high_risk_rejection_rate' && Number.isFinite(alert.value)) {
    return language === 'th'
      ? `${(alert.value * 100).toFixed(0)}% ในหน้าต่าง ${alert.windowCycles || 6} รอบ`
      : `${(alert.value * 100).toFixed(0)}% across the ${alert.windowCycles || 6}-cycle window`;
  }
  if (Number.isFinite(alert.value) && Number.isFinite(alert.threshold)) {
    return language === 'th'
      ? `พบ ${alert.value} · เกณฑ์ ${alert.threshold}`
      : `Observed ${alert.value} · threshold ${alert.threshold}`;
  }
  if (Number.isFinite(alert.value)) {
    return language === 'th' ? `ค่า ${alert.value}` : `Value ${alert.value}`;
  }
  return language === 'th' ? 'รายงานโดย Manager_Agent' : 'Reported by Manager_Agent';
}

function AlertIcon({ severity }) {
  if (severity === 'critical') return <ShieldAlert aria-hidden="true" />;
  if (severity === 'warning') return <TriangleAlert aria-hidden="true" />;
  return <CircleAlert aria-hidden="true" />;
}

export default function DecisionAnalyticsPanel({ analytics, language = 'th' }) {
  const [windowSize, setWindowSize] = useState(6);
  const selectedWindow = useMemo(
    () => analytics.windows.find((window) => window.size === windowSize) || analytics.windows[0],
    [analytics.windows, windowSize],
  );

  const statusLabel = analytics.overallStatus === 'critical'
    ? (language === 'th' ? 'วิกฤต' : 'Critical')
    : analytics.overallStatus === 'warning'
      ? (language === 'th' ? 'ต้องตรวจสอบ' : 'Warning')
      : (language === 'th' ? 'ปกติ' : 'Healthy');

  return (
    <section
      className="panel decision-history-panel"
      aria-labelledby="decision-analytics-title"
      data-testid="decision-analytics-panel"
    >
      <div className="observability-heading history-heading">
        <div>
          <p className="eyebrow"><BarChart3 aria-hidden="true" /> Phase 18</p>
          <h2 id="decision-analytics-title">
            {language === 'th' ? 'Decision Analytics และ Safety Alerts' : 'Decision Analytics and Safety Alerts'}
          </h2>
          <p>
            {language === 'th'
              ? 'สรุปจาก meaningful Decision History ของ Manager_Agent เท่านั้น โดยไม่เอา metadata-only cycles มาปนกับ trading rates'
              : 'Derived only from Manager_Agent meaningful decision history; metadata-only cycles are excluded from trading rates.'}
          </p>
        </div>
        <div className="history-retention">
          <span>{language === 'th' ? 'สถานะรวม' : 'Overall status'}</span>
          <strong data-testid="decision-analytics-status">{statusLabel}</strong>
        </div>
      </div>

      <div className="observability-facts" data-testid="decision-analytics-summary">
        <div>
          <span>{language === 'th' ? 'Meaningful cycles' : 'Meaningful cycles'}</span>
          <strong>{analytics.dataQuality.meaningfulCycles}/{analytics.dataQuality.historyCycles}</strong>
        </div>
        <div>
          <span>{language === 'th' ? 'Candidates' : 'Candidates'}</span>
          <strong>{selectedWindow.metrics.candidateCount}</strong>
        </div>
        <div>
          <span>{language === 'th' ? 'Blocked rate' : 'Blocked rate'}</span>
          <strong>{percent(selectedWindow.rates.blockedRate)}</strong>
        </div>
        <div>
          <span>{language === 'th' ? 'Execution rate' : 'Execution rate'}</span>
          <strong>{percent(selectedWindow.rates.executionRate)}</strong>
        </div>
      </div>

      <div className="history-filters" aria-label={language === 'th' ? 'เลือกช่วงวิเคราะห์' : 'Select analytics window'}>
        <Filter aria-hidden="true" />
        <label>
          <span>{language === 'th' ? 'Rolling window' : 'Rolling window'}</span>
          <select
            data-testid="decision-analytics-window-filter"
            value={windowSize}
            onChange={(event) => setWindowSize(Number(event.target.value))}
          >
            {analytics.windows.map((window) => (
              <option key={window.size} value={window.size}>
                {window.size} cycles ({window.cyclesAvailable} {language === 'th' ? 'มีข้อมูล' : 'available'})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="observability-candidates-section">
        <div className="observability-section-title">
          <h3>{language === 'th' ? 'Safety / Data Quality alerts' : 'Safety / Data Quality alerts'}</h3>
          <span>{analytics.alerts.length}/8</span>
        </div>
        {analytics.alerts.length ? (
          <div className="history-drilldown" data-testid="decision-analytics-alerts">
            {analytics.alerts.map((alert) => (
              <div
                key={alert.code}
                className="observability-context-note"
                role="status"
                data-severity={alert.severity}
                data-testid={`decision-analytics-alert-${alert.code}`}
              >
                <AlertIcon severity={alert.severity} />
                <div>
                  <strong>{localized(ALERT_COPY, alert.code, language)}</strong>
                  <span>{alert.severity.toUpperCase()} · {alertDetail(alert, language)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="history-empty" role="status" data-testid="decision-analytics-alerts-empty">
            <ShieldCheck aria-hidden="true" />
            {language === 'th' ? 'Manager ไม่รายงาน Safety alert ที่ active' : 'Manager reports no active safety alerts.'}
          </div>
        )}
      </div>

      <div className="observability-stage-section">
        <h3>{language === 'th' ? 'Candidate conversion funnel' : 'Candidate conversion funnel'}</h3>
        <ol
          className="history-stage-path"
          tabIndex={0}
          aria-label={language === 'th' ? 'Conversion funnel 7 ขั้น' : 'Seven-stage conversion funnel'}
          data-testid="decision-analytics-funnel"
        >
          {selectedWindow.funnel.map((stage) => (
            <li key={stage.stage} className={stage.reachedCount > 0 ? 'status-success' : undefined}>
              <span>{localized(STAGE_LABELS, stage.stage, language)}</span>
              <strong>{stage.reachedCount} · {percent(stage.reachRate)}</strong>
            </li>
          ))}
        </ol>
      </div>

      <div className="observability-candidates-section">
        <div className="observability-section-title">
          <h3>{language === 'th' ? 'เหตุผลที่บล็อกบ่อยที่สุด' : 'Top blocking reasons'}</h3>
          <span>{selectedWindow.size} cycles</span>
        </div>
        {selectedWindow.topBlockingReasons.length ? (
          <div
            className="history-candidate-table-wrap"
            tabIndex={0}
            role="region"
            aria-label={language === 'th' ? 'Top blocking reasons' : 'Top blocking reasons'}
            data-testid="decision-analytics-top-reasons"
          >
            <table className="history-candidate-table">
              <caption className="sr-only">Top blocking reasons</caption>
              <thead>
                <tr><th>{language === 'th' ? 'เหตุผล' : 'Reason'}</th><th>Count</th><th>{language === 'th' ? 'สัดส่วน Blocked' : 'Share of blocked'}</th></tr>
              </thead>
              <tbody>
                {selectedWindow.topBlockingReasons.map((reason) => (
                  <tr key={reason.code}>
                    <td>{localized(REASON_COPY, reason.code, language)}</td>
                    <td>{reason.count}</td>
                    <td>{percent(reason.shareOfBlockedCandidates)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="history-empty" role="status" data-testid="decision-analytics-top-reasons-empty">
            <Activity aria-hidden="true" />
            {language === 'th' ? 'ยังไม่มี blocked reason ในช่วงนี้' : 'No blocking reasons in this window.'}
          </div>
        )}
      </div>

      <div className="observability-candidates-section">
        <h3>{language === 'th' ? 'Trend: 6 รอบล่าสุดเทียบ 6 รอบก่อนหน้า' : 'Trend: latest 6 vs previous 6'}</h3>
        {analytics.trend.enoughData ? (
          <div className="history-detail-grid" data-testid="decision-analytics-trend">
            <div><dt>Candidate Δ</dt><dd>{analytics.trend.candidateCountDelta > 0 ? '+' : ''}{analytics.trend.candidateCountDelta}</dd></div>
            <div><dt>Blocked rate Δ</dt><dd>{signedPoints(analytics.trend.blockedRateDeltaPoints)}</dd></div>
            <div><dt>Execution rate Δ</dt><dd>{signedPoints(analytics.trend.executionRateDeltaPoints)}</dd></div>
            <div><dt>Risk rejection Δ</dt><dd>{signedPoints(analytics.trend.riskRejectionRateDeltaPoints)}</dd></div>
          </div>
        ) : (
          <div className="history-empty" role="status" data-testid="decision-analytics-trend-pending">
            <Activity aria-hidden="true" />
            {language === 'th'
              ? `ต้องมี meaningful history 12 รอบ ตอนนี้มี ${analytics.dataQuality.meaningfulCycles}`
              : `Twelve meaningful cycles are required; ${analytics.dataQuality.meaningfulCycles} are currently available.`}
          </div>
        )}
      </div>

      {analytics.dataQuality.metadataOnlyCycles > 0 ? (
        <div className="observability-context-note" role="status" data-testid="decision-analytics-data-quality">
          <TriangleAlert aria-hidden="true" />
          <div>
            <strong>{language === 'th' ? 'Metadata-only cycles ถูกแยกออกจาก trading rates' : 'Metadata-only cycles are excluded from trading rates'}</strong>
            <span>
              {analytics.dataQuality.metadataOnlyCycles} / {analytics.dataQuality.historyCycles} cycles · {analytics.dataQuality.latestCycleSource}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
