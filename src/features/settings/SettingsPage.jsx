import { RotateCcw, Settings2 } from 'lucide-react';

const copy = {
  th: {
    title: 'การตั้งค่า',
    intro: 'ปรับหน้าตา การรีเฟรช และความเป็นส่วนตัวของแดชบอร์ด การตั้งค่าเหล่านี้อยู่ในอุปกรณ์นี้เท่านั้น',
    themeGroup: 'ธีม',
    theme: 'ธีมสี',
    display: 'การแสดงผล',
    density: 'ความหนาแน่น',
    motion: 'ลดการเคลื่อนไหว',
    refreshGroup: 'การรีเฟรช',
    refresh: 'รีเฟรชอัตโนมัติ',
    focus: 'รีเฟรชเมื่อกลับมาที่หน้าเว็บ',
    freshness: 'ความสดใหม่ของข้อมูล',
    stale: 'เตือนข้อมูลเก่า หลังจาก',
    privacy: 'ความเป็นส่วนตัว',
    maskValues: 'ซ่อนมูลค่าบัญชี',
    maskSizes: 'ซ่อนจำนวน Position',
    navigation: 'การนำทาง',
    defaultPage: 'หน้าเริ่มต้น',
    reset: 'คืนค่าเริ่มต้น',
    saved: 'บันทึกอัตโนมัติแล้ว',
    seconds: 'วินาที',
  },
  en: {
    title: 'Settings',
    intro: 'Customize dashboard appearance, refresh behavior, and privacy. These preferences stay on this device only.',
    themeGroup: 'Theme',
    theme: 'Color theme',
    display: 'Display',
    density: 'Density',
    motion: 'Reduce motion',
    refreshGroup: 'Refresh',
    refresh: 'Auto refresh',
    focus: 'Refresh when returning to the tab',
    freshness: 'Data freshness',
    stale: 'Warn about stale data after',
    privacy: 'Privacy',
    maskValues: 'Mask account values',
    maskSizes: 'Mask position sizes',
    navigation: 'Navigation',
    defaultPage: 'Default landing page',
    reset: 'Reset defaults',
    saved: 'Saved automatically',
    seconds: 'seconds',
  },
};

const pageOptions = ['overview', 'portfolio', 'orders', 'agents', 'risk', 'backtest', 'system'];

function Field({ label, children, hint }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      className={`settings-toggle ${checked ? 'is-on' : ''}`}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </button>
  );
}

export default function SettingsPage({ language, preferences, onChange, onReset }) {
  const text = copy[language] ?? copy.en;
  const update = (key, value) => onChange({ ...preferences, [key]: value });

  return (
    <section className="settings-workspace" aria-labelledby="settings-title" data-testid="page-settings">
      <div className="settings-hero panel">
        <div>
          <p className="eyebrow"><Settings2 aria-hidden="true" /> Phase 10</p>
          <h2 id="settings-title">{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <p className="settings-saved" role="status">{text.saved}</p>
      </div>

      <div className="settings-grid">
        <section className="panel settings-card" data-testid="settings-theme-group">
          <h3>{text.themeGroup}</h3>
          <Field label={text.theme}>
            <select value={preferences.theme} onChange={(event) => update('theme', event.target.value)}>
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Field>
        </section>

        <section className="panel settings-card" data-testid="settings-display-group">
          <h3>{text.display}</h3>
          <Field label={text.density}>
            <select value={preferences.density} onChange={(event) => update('density', event.target.value)}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </Field>
          <Toggle checked={preferences.reducedMotion} onChange={(value) => update('reducedMotion', value)} label={text.motion} />
        </section>

        <section className="panel settings-card" data-testid="settings-refresh-group">
          <h3>{text.refreshGroup}</h3>
          <Field label={text.refresh}>
            <select value={preferences.refreshInterval} onChange={(event) => update('refreshInterval', Number(event.target.value))}>
              <option value={0}>Off</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </Field>
          <Toggle checked={preferences.refreshOnFocus} onChange={(value) => update('refreshOnFocus', value)} label={text.focus} />
        </section>

        <section className="panel settings-card" data-testid="settings-freshness-group">
          <h3>{text.freshness}</h3>
          <Field label={text.stale} hint={text.seconds}>
            <input
              type="number"
              min="30"
              max="900"
              step="30"
              value={preferences.staleWarningSeconds}
              onChange={(event) => update('staleWarningSeconds', Number(event.target.value))}
            />
          </Field>
        </section>

        <section className="panel settings-card" data-testid="settings-privacy-group">
          <h3>{text.privacy}</h3>
          <Toggle checked={preferences.maskAccountValues} onChange={(value) => update('maskAccountValues', value)} label={text.maskValues} />
          <Toggle checked={preferences.maskPositionSizes} onChange={(value) => update('maskPositionSizes', value)} label={text.maskSizes} />
          <p className="settings-security-note">Operator tokens, API keys, broker credentials, and passwords are never stored here.</p>
        </section>

        <section className="panel settings-card" data-testid="settings-navigation-group">
          <h3>{text.navigation}</h3>
          <Field label={text.defaultPage}>
            <select value={preferences.defaultPage} onChange={(event) => update('defaultPage', event.target.value)}>
              {pageOptions.map((page) => <option key={page} value={page}>{page}</option>)}
            </select>
          </Field>
          <button className="settings-reset" type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" /> {text.reset}
          </button>
        </section>
      </div>
    </section>
  );
}
