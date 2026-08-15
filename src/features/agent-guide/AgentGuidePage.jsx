import {
  ArrowRight,
  Ban,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  CircleHelp,
  Database,
  FlaskConical,
  GitBranch,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AGENT_FLOW_STAGES,
  AGENT_GUIDE,
  AGENT_GUIDE_CATEGORIES,
  filterAgentGuide,
  localize,
} from './agentGuideData.js';

const COPY = {
  en: {
    eyebrow: 'Phase 22 · Agent Knowledge & Rules Center',
    title: 'Understand how every AI agent works',
    intro: 'Read each agent in natural language: what it receives, what it may do, what it must never do, and where its decision goes next.',
    boundaryTitle: 'Documentation, not a control surface',
    boundary: 'This page explains the intended agent contracts. It does not call agents directly, prove runtime health, or bypass Manager_Agent.',
    flowEyebrow: 'System flow',
    flowTitle: 'How a trading idea moves through the system',
    flowDescription: 'Select any agent in the flow to open its rules. The safety gate remains between analysis and execution.',
    directoryEyebrow: 'Agent directory',
    directoryTitle: 'AI team',
    search: 'Search agent rules',
    searchPlaceholder: 'Search agent, responsibility, or rule',
    filters: 'Filter agent category',
    all: 'All',
    noMatches: 'No agent matches this search.',
    mission: 'Mission',
    responsibilities: 'What I do',
    rules: 'Rules I must follow',
    forbidden: 'What I must never do',
    receives: 'I receive information from',
    sendsTo: 'I send results to',
    example: 'Example in natural language',
    selectAgent: 'Select an agent to read its operating rules.',
    agentCount: 'agents documented',
    categories: {
      orchestration: 'Orchestration',
      analysis: 'Analysis',
      portfolio: 'Portfolio',
      safety: 'Safety',
      execution: 'Execution',
      research: 'Research',
    },
  },
  th: {
    eyebrow: 'Phase 22 · ศูนย์ความรู้และกฎของ Agent',
    title: 'เข้าใจการทำงานของ AI Agent ทุกตัว',
    intro: 'อ่านการทำงานของแต่ละ Agent เป็นภาษาธรรมชาติ ว่ารับข้อมูลอะไร ทำอะไรได้ ห้ามทำอะไร และส่งผลต่อให้ใคร',
    boundaryTitle: 'หน้านี้เป็นคู่มือ ไม่ใช่หน้าควบคุม',
    boundary: 'หน้านี้อธิบาย Contract ที่ระบบตั้งใจใช้ ไม่ได้เรียก Agent โดยตรง ไม่ได้ยืนยัน Runtime Health และไม่ข้าม Manager_Agent',
    flowEyebrow: 'ลำดับการทำงานของระบบ',
    flowTitle: 'ไอเดียการเทรดเดินทางผ่านระบบอย่างไร',
    flowDescription: 'กด Agent ใน Flow เพื่อเปิดกฎของ Agent ตัวนั้น โดย Risk gate ยังคงคั่นอยู่ก่อนขั้น Execution เสมอ',
    directoryEyebrow: 'รายชื่อ Agent',
    directoryTitle: 'ทีม AI',
    search: 'ค้นหากฎของ Agent',
    searchPlaceholder: 'ค้นหา Agent หน้าที่ หรือกฎ',
    filters: 'กรอง Agent ตามหมวด',
    all: 'ทั้งหมด',
    noMatches: 'ไม่พบ Agent ที่ตรงกับการค้นหา',
    mission: 'ภารกิจ',
    responsibilities: 'ฉันทำอะไร',
    rules: 'กฎที่ฉันต้องทำตาม',
    forbidden: 'สิ่งที่ฉันห้ามทำ',
    receives: 'ฉันรับข้อมูลจาก',
    sendsTo: 'ฉันส่งผลลัพธ์ให้',
    example: 'ตัวอย่างแบบภาษาธรรมชาติ',
    selectAgent: 'เลือก Agent เพื่ออ่านกฎการทำงาน',
    agentCount: 'Agent ที่มีคู่มือ',
    categories: {
      orchestration: 'การประสานงาน',
      analysis: 'การวิเคราะห์',
      portfolio: 'การจัดการพอร์ต',
      safety: 'ความปลอดภัย',
      execution: 'การส่งคำสั่ง',
      research: 'การเรียนรู้และวิจัย',
    },
  },
};

const CATEGORY_ICONS = {
  orchestration: GitBranch,
  analysis: Sparkles,
  portfolio: Database,
  safety: ShieldCheck,
  execution: CheckCircle2,
  research: FlaskConical,
};

function FlowStage({ stage, language, onSelectAgent }) {
  return (
    <li className={`agent-flow-stage ${stage.id}`} data-testid={`agent-flow-stage-${stage.id}`}>
      <div className="agent-flow-copy">
        <strong>{localize(stage.title, language)}</strong>
        <span>{localize(stage.description, language)}</span>
      </div>
      <div className="agent-flow-agents">
        {stage.agents.map((agentId) => {
          const agent = AGENT_GUIDE.find((item) => item.id === agentId);
          if (!agent) return null;
          return (
            <button type="button" key={agentId} onClick={() => onSelectAgent(agentId)}>
              {agent.name.replace('_Agent', '')}
            </button>
          );
        })}
      </div>
      <ArrowRight className="agent-flow-arrow" aria-hidden="true" />
    </li>
  );
}

function BulletSection({ icon: Icon, title, items, language, tone = '' }) {
  return (
    <section className={`agent-guide-detail-section ${tone}`}>
      <h3><Icon aria-hidden="true" />{title}</h3>
      <ul>
        {items.map((item) => <li key={item.en}>{localize(item, language)}</li>)}
      </ul>
    </section>
  );
}

function AgentDetail({ agent, language, text }) {
  if (!agent) {
    return <div className="panel agent-guide-empty"><CircleHelp aria-hidden="true" /><p>{text.selectAgent}</p></div>;
  }
  const CategoryIcon = CATEGORY_ICONS[agent.category] || Bot;

  return (
    <article className="panel agent-guide-detail" id="agent-guide-detail" data-testid="agent-guide-detail">
      <header className="agent-guide-detail-header">
        <span className={`agent-guide-category-icon ${agent.category}`}><CategoryIcon aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">{text.categories[agent.category]}</p>
          <h2>{agent.name}</h2>
          <p className="agent-guide-role">{localize(agent.role, language)}</p>
        </div>
      </header>

      <section className="agent-guide-mission">
        <span>{text.mission}</span>
        <p>{localize(agent.mission, language)}</p>
      </section>

      <div className="agent-guide-section-grid">
        <BulletSection icon={BookOpenCheck} title={text.responsibilities} items={agent.responsibilities} language={language} />
        <BulletSection icon={ShieldCheck} title={text.rules} items={agent.rules} language={language} tone="rules" />
        <BulletSection icon={Ban} title={text.forbidden} items={agent.forbidden} language={language} tone="forbidden" />
      </div>

      <div className="agent-guide-interfaces">
        <section>
          <h3>{text.receives}</h3>
          <div>{agent.receives.map((item) => <span className="pill" key={item}>{item}</span>)}</div>
        </section>
        <section>
          <h3>{text.sendsTo}</h3>
          <div>{agent.sendsTo.map((item) => <span className="pill" key={item}>{item}</span>)}</div>
        </section>
      </div>

      <section className="agent-guide-example">
        <h3><Sparkles aria-hidden="true" />{text.example}</h3>
        <p>{localize(agent.example, language)}</p>
      </section>
    </article>
  );
}

export default function AgentGuidePage({ language = 'en' }) {
  const text = COPY[language] ?? COPY.en;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState('manager');
  const agents = useMemo(
    () => filterAgentGuide({ query, category }),
    [category, query],
  );
  const selectedAgent = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;

  const selectFromFlow = (agentId) => {
    setQuery('');
    setCategory('all');
    setSelectedId(agentId);
  };

  return (
    <div className="page-stack agent-guide" data-testid="page-agent-guide">
      <section className="panel agent-guide-hero">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <span className="agent-guide-count"><strong>{AGENT_GUIDE.length}</strong>{text.agentCount}</span>
      </section>

      <section className="agent-guide-boundary" aria-label={text.boundaryTitle}>
        <ShieldCheck aria-hidden="true" />
        <div><strong>{text.boundaryTitle}</strong><p>{text.boundary}</p></div>
      </section>

      <section className="panel agent-flow" aria-labelledby="agent-flow-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text.flowEyebrow}</p>
            <h2 id="agent-flow-title">{text.flowTitle}</h2>
            <p>{text.flowDescription}</p>
          </div>
        </div>
        <ol className="agent-flow-list">
          {AGENT_FLOW_STAGES.map((stage) => (
            <FlowStage key={stage.id} stage={stage} language={language} onSelectAgent={selectFromFlow} />
          ))}
        </ol>
      </section>

      <section className="panel agent-guide-toolbar" aria-label={text.directoryTitle}>
        <div className="section-heading">
          <div><p className="eyebrow">{text.directoryEyebrow}</p><h2>{text.directoryTitle}</h2></div>
          <span className="pill">{agents.length} / {AGENT_GUIDE.length}</span>
        </div>
        <label className="agent-guide-search">
          <span className="sr-only">{text.search}</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.searchPlaceholder}
            aria-label={text.search}
            data-testid="agent-guide-search"
          />
        </label>
        <div className="agent-guide-filters" role="group" aria-label={text.filters}>
          <button type="button" className={category === 'all' ? 'active' : ''} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>{text.all}</button>
          {AGENT_GUIDE_CATEGORIES.map((key) => (
            <button type="button" key={key} className={category === key ? 'active' : ''} aria-pressed={category === key} onClick={() => setCategory(key)}>
              {text.categories[key]}
            </button>
          ))}
        </div>
      </section>

      <div className="agent-guide-workspace">
        <section className="panel agent-guide-directory" aria-live="polite">
          {agents.length ? agents.map((agent) => {
            const Icon = CATEGORY_ICONS[agent.category] || Bot;
            const active = selectedAgent?.id === agent.id;
            return (
              <button
                type="button"
                key={agent.id}
                className={`agent-guide-card ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => setSelectedId(agent.id)}
                data-testid={`agent-guide-card-${agent.id}`}
              >
                <span className={`agent-guide-category-icon ${agent.category}`}><Icon aria-hidden="true" /></span>
                <span><strong>{agent.name}</strong><small>{localize(agent.role, language)}</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
            );
          }) : <p className="agent-guide-no-results">{text.noMatches}</p>}
        </section>

        <AgentDetail agent={selectedAgent} language={language} text={text} />
      </div>
    </div>
  );
}
