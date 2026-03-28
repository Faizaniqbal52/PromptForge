import { useState, useRef, useEffect, useCallback } from 'react';

const STAGES = { INPUT: 'input', CLARIFYING: 'clarifying', GENERATING: 'generating', DONE: 'done' };

const SP = `You are a senior product and engineering consultant who translates vague requirements into precise AI prompts.

PHASE 1 - CLARIFICATION: Ask 3-5 sharp clarifying questions about audience, visual style, tech stack, scope, and success criteria.
Return ONLY JSON: {"phase":"clarify","questions":["q1","q2"]}

PHASE 2 - PROMPT GENERATION: Generate structured ready-to-use AI prompts broken into ordered steps. Each prompt must be self-contained and detailed.
Return ONLY JSON: {"phase":"prompts","summary":"summary text","prompts":[{"step":1,"title":"title","goal":"goal","prompt":"full prompt"}]}

NEVER return anything outside JSON. No markdown fences.`;

/* ─── Icons ─── */
const MicIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.25s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);


/* ─── Main Component ─── */
export default function PromptForge() {
  const [stage, setStage] = useState(STAGES.INPUT);
  const [requirements, setRequirements] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedStep, setExpandedStep] = useState(null);
  const [copied, setCopied] = useState(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const finalRef = useRef('');
  const bottomRef = useRef(null);

  // Speech recognition setup
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setVoiceSupported(true);
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onstart = () => setListening(true);
    r.onresult = (e) => {
      let buf = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { finalRef.current += t + ' '; setRequirements(finalRef.current); }
        else buf += t;
      }
      setInterim(buf);
    };
    r.onerror = (e) => { if (e.error !== 'aborted') setError('Voice error: ' + e.error); setListening(false); setInterim(''); };
    r.onend = () => { setListening(false); setInterim(''); };
    recognitionRef.current = r;
  }, []);

  const toggleVoice = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) { r.stop(); } else { setError(null); finalRef.current = requirements; r.start(); }
  }, [listening, requirements]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [stage, questions, result]);

  async function callAI(messages) {
    const res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, system: SP }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }

    const text = data.choices[0].message.content.trim();
    return JSON.parse(text);
  }

  async function submitReqs() {
    if (!requirements.trim()) return;
    if (listening) recognitionRef.current?.stop();
    setLoading(true); setError(null);
    try {
      const json = await callAI([{ role: 'user', content: 'Requirements:\n\n' + requirements }]);
      setQuestions(json.questions || []);
      setAnswers(Object.fromEntries((json.questions || []).map((_, i) => [i, ''])));
      setStage(STAGES.CLARIFYING);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function submitAnswers() {
    if (questions.some((_, i) => !answers[i]?.trim())) return;
    setLoading(true); setError(null); setStage(STAGES.GENERATING);
    try {
      const at = questions.map((q, i) => 'Q: ' + q + '\nA: ' + answers[i]).join('\n\n');
      const json = await callAI([
        { role: 'user', content: 'Requirements:\n\n' + requirements },
        { role: 'assistant', content: JSON.stringify({ phase: 'clarify', questions }) },
        { role: 'user', content: 'Answers:\n\n' + at + '\n\nNow generate the prompts.' },
      ]);
      setResult(json); setStage(STAGES.DONE); setExpandedStep(0);
    } catch (err) { setError(err.message); setStage(STAGES.CLARIFYING); }
    setLoading(false);
  }

  function copy(text, idx) {
    navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000); });
  }

  function copyAll() {
    if (!result?.prompts) return;
    const full = result.prompts.map((p) => `── Step ${p.step}: ${p.title} ──\nGoal: ${p.goal}\n\n${p.prompt}`).join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
    navigator.clipboard.writeText(full).then(() => { setCopied('all'); setTimeout(() => setCopied(null), 2000); });
  }

  function reset() {
    if (listening) recognitionRef.current?.stop();
    setStage(STAGES.INPUT); setRequirements(''); setQuestions([]); setAnswers({});
    setResult(null); setError(null); setExpandedStep(null); setInterim(''); finalRef.current = '';
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* ── Ambient background ── */}
        <div className="ambient" />
        <div className="grain" />

        {/* ── Navigation ── */}
        <nav className="nav">
          <div className="nav-brand">
            <div className="logo-icon"><SparkleIcon /></div>
            <span className="logo-text">PromptForge</span>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main className="main">
          {/* Hero */}
          <header className="hero">
            <div className="hero-badge">AI Prompt Agent</div>
            <h1 className="hero-title">
              Tell me what you<br />want to <span className="hero-accent">build.</span>
            </h1>
            <p className="hero-sub">Describe your idea. I'll ask smart questions, then generate structured, copy-paste-ready AI prompts.</p>
          </header>

          {/* ── Stage: Input ── */}
          {stage === STAGES.INPUT && (
            <div className="card fade-in" id="input-card">
              <div className="card-label">Your Requirements</div>
              {listening && <div className="listening-badge"><span className="pulse-dot" /> Listening — speak now</div>}
              <div className="textarea-wrap">
                <textarea
                  id="requirements-input"
                  className={listening ? 'listening' : ''}
                  placeholder="e.g. Build me a SaaS dashboard with user auth, Stripe billing, and a dark mode..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReqs(); }}
                />
                {voiceSupported && (
                  <button className={'mic-btn ' + (listening ? 'active' : '')} onClick={toggleVoice} id="mic-btn">
                    {listening ? <StopIcon /> : <MicIcon />}
                  </button>
                )}
              </div>
              {interim && <div className="interim-text">{interim}</div>}
              {error && <div className="error-msg">{error}</div>}
              <div className="card-actions">
                <button className="btn-primary" onClick={submitReqs} disabled={loading || !requirements.trim()} id="analyze-btn">
                  {loading ? <><span className="spinner" />Analyzing...</> : 'Analyze Requirements'}
                </button>
              </div>
              <div className="shortcut-hint">Ctrl + Enter to submit</div>
            </div>
          )}

          {/* ── Stage: Clarifying ── */}
          {stage === STAGES.CLARIFYING && (
            <>
              <div className="card card-muted fade-in">
                <div className="card-label">Your Requirements</div>
                <div className="req-preview">{requirements}</div>
              </div>
              <div className="card fade-in" id="clarify-card">
                <div className="card-label">Clarifying Questions</div>
                <p className="card-desc">Answer these so I can generate precise, tailored prompts for your project.</p>
                {questions.map((q, i) => (
                  <div key={i} className="question-block">
                    <div className="question-text">
                      <span className="question-num">{i + 1}</span>{q}
                    </div>
                    <textarea
                      className="answer-input"
                      rows={2}
                      value={answers[i] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                      placeholder="Your answer..."
                      id={`answer-${i}`}
                    />
                  </div>
                ))}
                {error && <div className="error-msg">{error}</div>}
                <div className="card-actions">
                  <button className="btn-primary" onClick={submitAnswers} disabled={loading || questions.some((_, i) => !answers[i]?.trim())} id="generate-btn">
                    {loading ? <><span className="spinner" />Generating...</> : 'Generate Prompts'}
                  </button>
                  <button className="btn-ghost" onClick={reset}>Start Over</button>
                </div>
              </div>
            </>
          )}

          {/* ── Stage: Generating ── */}
          {stage === STAGES.GENERATING && (
            <div className="card generating-card fade-in">
              <div className="gen-anim">
                <span className="gen-dot" style={{ animationDelay: '0s' }} />
                <span className="gen-dot" style={{ animationDelay: '0.15s' }} />
                <span className="gen-dot" style={{ animationDelay: '0.3s' }} />
              </div>
              <div className="gen-text">Forging your prompt sequence...</div>
              <div className="gen-sub">This usually takes 10-20 seconds</div>
            </div>
          )}

          {/* ── Stage: Done ── */}
          {stage === STAGES.DONE && result && (
            <>
              <div className="card summary-card fade-in" id="summary-card">
                <div className="card-label">Plan Summary</div>
                <p className="summary-text">{result.summary}</p>
              </div>

              <div className="results-section fade-in">
                <div className="results-header">
                  <div className="card-label" style={{ marginBottom: 0 }}>{result.prompts?.length} Prompts — use in order</div>
                  <button className={'copy-all-btn' + (copied === 'all' ? ' copied' : '')} onClick={copyAll} id="copy-all-btn">
                    {copied === 'all' ? <><CheckIcon /> Copied All</> : <><CopyIcon /> Copy All</>}
                  </button>
                </div>

                {result.prompts?.map((p, i) => (
                  <div key={i} className={'step-row' + (expandedStep === i ? ' expanded' : '')} id={`step-${i}`}>
                    <div className="step-header" onClick={() => setExpandedStep(expandedStep === i ? null : i)}>
                      <span className={'step-num' + (expandedStep === i ? ' active' : '')}>{p.step}</span>
                      <div className="step-info">
                        <div className="step-title">{p.title}</div>
                        {expandedStep !== i && <div className="step-goal-preview">{p.goal}</div>}
                      </div>
                      <ChevronIcon open={expandedStep === i} />
                    </div>
                    {expandedStep === i && (
                      <div className="step-body">
                        <div className="step-goal">{p.goal}</div>
                        <div className="step-toolbar">
                          <span className="step-tag">Paste into any AI</span>
                          <button className={'copy-btn' + (copied === i ? ' copied' : '')} onClick={() => copy(p.prompt, i)}>
                            {copied === i ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy Prompt</>}
                          </button>
                        </div>
                        <pre className="prompt-block">{p.prompt}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="done-actions fade-in">
                <button className="btn-ghost" onClick={reset} id="restart-btn">Start a new project</button>
              </div>
            </>
          )}

          <div ref={bottomRef} />
        </main>

        {/* Footer */}
        <footer className="footer">
          <span>Built with</span>
          <span className="footer-heart">♥</span>
          <span>by PromptForge</span>
          <span className="footer-sep">·</span>
          <span>Powered by Claude</span>
        </footer>
      </div>
    </>
  );
}


/* ═══════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════ */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #06060b;
  --surface:  #0c0c14;
  --card:     #10101c;
  --border:   #1a1a2e;
  --border-h: #2a2a45;
  --accent:   #6c5ce7;
  --accent-h: #5a4bd6;
  --accent-g: linear-gradient(135deg, #6c5ce7, #a855f7);
  --text:     #e8e6f0;
  --text-2:   #9896a8;
  --text-3:   #5a5870;
  --danger:   #f87171;
  --success:  #34d399;
  --radius:   14px;
}

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ── Ambient Background ── */
.ambient {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at 50% -20%, rgba(108,92,231,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 50%),
    radial-gradient(ellipse 50% 50% at 20% 70%, rgba(108,92,231,0.05) 0%, transparent 50%);
}

.grain {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ── App Shell ── */
.app {
  position: relative; z-index: 1;
  min-height: 100vh; display: flex; flex-direction: column;
}

/* ── Nav ── */
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px; max-width: 780px; width: 100%; margin: 0 auto;
}
.nav-brand { display: flex; align-items: center; gap: 10px; }
.logo-icon { color: var(--accent); display: flex; }
.logo-text { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }

/* ── Main ── */
.main {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 0 16px 100px; max-width: 780px; width: 100%; margin: 0 auto;
}

/* ── Hero ── */
.hero { width: 100%; margin-bottom: 32px; padding-top: 24px; }

.hero-badge {
  display: inline-flex; align-items: center;
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--accent); font-weight: 600; margin-bottom: 14px;
  padding: 4px 12px; border-radius: 20px;
  background: rgba(108,92,231,0.08); border: 1px solid rgba(108,92,231,0.15);
}

.hero-title {
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: clamp(28px, 6vw, 48px); line-height: 1.08;
  letter-spacing: -0.03em; color: var(--text);
}
.hero-accent {
  background: var(--accent-g); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.hero-sub { font-size: 14px; color: var(--text-3); margin-top: 14px; line-height: 1.6; max-width: 500px; }

/* ── Cards ── */
.card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 28px; width: 100%; margin-bottom: 16px;
  transition: border-color 0.3s ease;
}
.card:hover { border-color: var(--border-h); }
.card-muted { opacity: 0.6; }
.card-muted:hover { opacity: 0.8; }
.card-label {
  font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--accent); font-weight: 600; margin-bottom: 14px;
}
.card-desc { font-size: 13px; color: var(--text-3); margin-bottom: 22px; line-height: 1.5; }
.card-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

/* ── Textarea ── */
.textarea-wrap { position: relative; margin-bottom: 10px; }

textarea, .answer-input {
  width: 100%; background: var(--bg); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text); font-family: 'Inter', sans-serif;
  font-size: 13.5px; padding: 14px 50px 14px 16px; resize: vertical;
  outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 140px; line-height: 1.65;
}
textarea:focus, .answer-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(108,92,231,0.1); }
textarea.listening { border-color: var(--danger); box-shadow: 0 0 0 3px rgba(248,113,113,0.12); }
textarea::placeholder, .answer-input::placeholder { color: var(--text-3); }
.answer-input { min-height: unset; padding: 11px 16px; font-size: 13px; }
.shortcut-hint { font-size: 11px; color: var(--text-3); margin-top: 8px; opacity: 0.5; }

/* ── Mic Button ── */
.mic-btn {
  position: absolute; top: 12px; right: 12px;
  width: 34px; height: 34px; border-radius: 10px; border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
  background: var(--surface); color: var(--text-3);
  border: 1px solid var(--border);
}
.mic-btn:hover { background: var(--card); color: var(--text-2); border-color: var(--border-h); }
.mic-btn.active {
  background: var(--danger); color: #fff; border-color: var(--danger);
  animation: pulse-glow 1.5s infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(248,113,113,0); }
}

/* ── Listening ── */
.listening-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.15);
  border-radius: 20px; padding: 5px 14px 5px 10px;
  font-size: 11.5px; color: var(--danger); font-weight: 500; margin-bottom: 12px;
}
.pulse-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--danger);
  animation: pulse-dot 1s infinite;
}
@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
.interim-text { font-size: 12px; color: rgba(248,113,113,0.5); font-style: italic; margin-bottom: 10px; min-height: 16px; }

/* ── Buttons ── */
.btn-primary {
  background: var(--accent-g); color: #fff; border: none;
  border-radius: 10px; padding: 12px 28px;
  font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;
  box-shadow: 0 2px 12px rgba(108,92,231,0.25);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(108,92,231,0.35); }
.btn-primary:active { transform: translateY(0) scale(0.98); }
.btn-primary:disabled { opacity: 0.3; cursor: default; transform: none; box-shadow: none; }

.btn-ghost {
  background: transparent; color: var(--text-3); border: 1px solid var(--border);
  border-radius: 10px; padding: 10px 20px;
  font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500;
  cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;
}
.btn-ghost:hover { border-color: var(--accent); color: var(--text-2); }

/* ── Error ── */
.error-msg {
  font-size: 12.5px; color: var(--danger); margin-bottom: 14px;
  padding: 10px 14px; background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.12);
  border-radius: 8px; line-height: 1.5;
}

/* ── Requirements Preview ── */
.req-preview { font-size: 13px; color: var(--text-3); line-height: 1.7; }

/* ── Questions ── */
.question-block { margin-bottom: 22px; }
.question-text {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; color: var(--text); margin-bottom: 10px; line-height: 1.6;
}
.question-num {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
  background: rgba(108,92,231,0.1); color: var(--accent);
  font-size: 11px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; margin-top: 1px;
}

/* ── Generating ── */
.generating-card { text-align: center; padding: 56px 28px !important; }
.gen-anim { display: flex; gap: 8px; justify-content: center; margin-bottom: 20px; }
.gen-dot {
  width: 10px; height: 10px; border-radius: 50%; background: var(--accent);
  animation: gen-bounce 1.2s ease-in-out infinite;
}
@keyframes gen-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.gen-text { font-size: 14px; color: var(--text-2); font-weight: 500; }
.gen-sub { font-size: 12px; color: var(--text-3); margin-top: 6px; }

/* ── Summary ── */
.summary-card { border-color: rgba(108,92,231,0.15) !important; }
.summary-text { font-size: 13.5px; color: var(--text-2); line-height: 1.75; }

/* ── Results ── */
.results-section { width: 100%; margin-bottom: 12px; }
.results-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px; gap: 12px; flex-wrap: wrap;
}
.copy-all-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  padding: 7px 14px; font-size: 11.5px; color: var(--text-3);
  font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.2s;
}
.copy-all-btn:hover { border-color: var(--accent); color: var(--text-2); }
.copy-all-btn.copied { border-color: rgba(52,211,153,0.3); color: var(--success); }

/* ── Step Rows ── */
.step-row {
  border: 1px solid var(--border); border-radius: 12px;
  margin-bottom: 10px; overflow: hidden; transition: border-color 0.25s;
}
.step-row.expanded { border-color: rgba(108,92,231,0.25); }
.step-header {
  display: flex; align-items: center; gap: 14px; padding: 16px 20px;
  cursor: pointer; user-select: none; background: var(--surface);
  transition: background 0.2s;
}
.step-header:hover { background: var(--card); }
.step-num {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  border: 1px solid var(--border-h);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: var(--text-3);
  transition: all 0.25s;
}
.step-num.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.step-info { flex: 1; min-width: 0; }
.step-title { font-size: 13.5px; font-weight: 500; color: var(--text); }
.step-goal-preview { font-size: 11.5px; color: var(--text-3); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.step-body { padding: 0 20px 20px; background: var(--bg); }
.step-goal { font-size: 12.5px; color: var(--text-3); margin-bottom: 14px; padding-top: 16px; line-height: 1.6; }
.step-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 4px; flex-wrap: wrap; gap: 8px;
}
.step-tag {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-3); background: var(--surface); border: 1px solid var(--border);
  padding: 3px 10px; border-radius: 6px; font-weight: 500;
}
.copy-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  padding: 6px 14px; font-size: 11.5px; color: var(--text-3);
  font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.2s;
}
.copy-btn:hover { border-color: var(--accent); color: var(--text-2); }
.copy-btn.copied { border-color: rgba(52,211,153,0.3); color: var(--success); }
.prompt-block {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 16px; margin-top: 10px;
  font-family: 'Inter', sans-serif; font-size: 12.5px;
  line-height: 1.75; color: var(--text-2);
  white-space: pre-wrap; word-break: break-word;
  max-height: 400px; overflow-y: auto;
}
.prompt-block::-webkit-scrollbar { width: 6px; }
.prompt-block::-webkit-scrollbar-track { background: transparent; }
.prompt-block::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* ── Done Actions ── */
.done-actions { width: 100%; display: flex; justify-content: flex-end; }

/* ── Footer ── */
.footer {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 20px; font-size: 11.5px; color: var(--text-3); opacity: 0.5;
}
.footer-heart { color: var(--accent); }
.footer-sep { opacity: 0.3; }

/* ── Spinner ── */
.spinner {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #fff; animation: spin-pulse 1.2s ease-in-out infinite;
}
@keyframes spin-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.6); }
}

/* ── Animations ── */
.fade-in { animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* ── Responsive ── */
@media (max-width: 600px) {
  .nav { padding: 14px 16px; }
  .hero { padding-top: 16px; }
  .hero-title { font-size: clamp(24px, 7vw, 36px); }
  .card { padding: 22px 18px; }
  .step-header { padding: 14px 16px; }
  .step-body { padding: 0 16px 16px; }
  .prompt-block { padding: 14px; font-size: 12px; }
}
`;
