import { useState, useRef, useEffect, useCallback } from 'react';

const STAGES = { INPUT: 'input', CLARIFYING: 'clarifying', GENERATING: 'generating', DONE: 'done' };

const SP = 'You are a senior product and engineering consultant who translates vague requirements into precise AI prompts.\n\nPHASE 1 - CLARIFICATION: Ask 3-5 sharp clarifying questions about audience, visual style, tech stack, scope, and success criteria.\nReturn ONLY JSON: {"phase":"clarify","questions":["q1","q2"]}\n\nPHASE 2 - PROMPT GENERATION: Generate structured ready-to-use AI prompts broken into ordered steps. Each prompt must be self-contained and detailed.\nReturn ONLY JSON: {"phase":"prompts","summary":"summary text","prompts":[{"step":1,"title":"title","goal":"goal","prompt":"full prompt"}]}\n\nNEVER return anything outside JSON. No markdown fences.';

const MicIcon = () => (
  <svg width='17' height='17' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
    <path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' />
    <path d='M19 10v2a7 7 0 0 1-14 0v-2' />
    <line x1='12' y1='19' x2='12' y2='23' />
    <line x1='8' y1='23' x2='16' y2='23' />
  </svg>
);

const StopIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor'>
    <rect x='4' y='4' width='16' height='16' rx='2' />
  </svg>
);

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

  async function callClaude(messages) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: SP, messages }),
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = data.content.map((b) => b.text || '').join('').trim();
    return JSON.parse(text);
  }

  async function submitReqs() {
    if (!requirements.trim()) return;
    if (listening) recognitionRef.current?.stop();
    setLoading(true); setError(null);
    try {
      const json = await callClaude([{ role: 'user', content: 'Requirements:\n\n' + requirements }]);
      setQuestions(json.questions || []);
      setAnswers(Object.fromEntries((json.questions || []).map((_, i) => [i, ''])));
      setStage(STAGES.CLARIFYING);
    } catch { setError('Something went wrong. Try again.'); }
    setLoading(false);
  }

  async function submitAnswers() {
    if (questions.some((_, i) => !answers[i]?.trim())) return;
    setLoading(true); setError(null); setStage(STAGES.GENERATING);
    try {
      const at = questions.map((q, i) => 'Q: ' + q + '\nA: ' + answers[i]).join('\n\n');
      const json = await callClaude([
        { role: 'user', content: 'Requirements:\n\n' + requirements },
        { role: 'assistant', content: JSON.stringify({ phase: 'clarify', questions }) },
        { role: 'user', content: 'Answers:\n\n' + at + '\n\nNow generate the prompts.' },
      ]);
      setResult(json); setStage(STAGES.DONE); setExpandedStep(0);
    } catch { setError('Something went wrong. Try again.'); setStage(STAGES.CLARIFYING); }
    setLoading(false);
  }

  function copy(text, idx) {
    navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000); });
  }

  function reset() {
    if (listening) recognitionRef.current?.stop();
    setStage(STAGES.INPUT); setRequirements(''); setQuestions([]); setAnswers({});
    setResult(null); setError(null); setExpandedStep(null); setInterim(''); finalRef.current = '';
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0a0f;color:#e8e6f0;font-family:'DM Mono',monospace}
    .wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:48px 16px 80px}
    .card{background:#12121c;border:1px solid #1e1e30;border-radius:12px;padding:28px;width:100%;max-width:700px;margin-bottom:16px}
    .tw{position:relative;margin-bottom:8px}
    textarea{width:100%;background:#0d0d18;border:1px solid #252535;border-radius:8px;color:#e8e6f0;font-family:'DM Mono',monospace;font-size:13px;padding:12px 48px 12px 14px;resize:vertical;outline:none;transition:border-color 0.2s;min-height:130px;line-height:1.6}
    textarea:focus{border-color:#5b4aff}
    textarea.on{border-color:#ef4444;box-shadow:0 0 0 2px #ef444422}
    .mb{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:8px;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s}
    .mb.off{background:#1a1a2e;color:#555}.mb.off:hover{background:#252540;color:#aaa}
    .mb.on{background:#ef4444;color:#fff;animation:mg 1.4s infinite}
    @keyframes mg{0%,100%{box-shadow:0 0 0 0 #ef444455}60%{box-shadow:0 0 0 7px #ef444400}}
    .it{font-size:11.5px;color:#ef444477;font-style:italic;margin-bottom:12px;min-height:16px}
    .lb{display:inline-flex;align-items:center;gap:6px;background:#1a0808;border:1px solid #ef444422;border-radius:20px;padding:3px 10px 3px 8px;font-size:11px;color:#ef4444;margin-bottom:10px}
    .dp{width:6px;height:6px;border-radius:50%;background:#ef4444;animation:dp 1s infinite}
    @keyframes dp{0%,100%{opacity:1}50%{opacity:0.3}}
    .bp{background:#5b4aff;color:#fff;border:none;border-radius:8px;padding:11px 28px;font-family:'DM Mono',monospace;font-size:13px;font-weight:500;cursor:pointer;transition:background 0.2s,transform 0.1s}
    .bp:hover{background:#4a3ae0}.bp:active{transform:scale(0.98)}.bp:disabled{background:#1e1e30;color:#444;cursor:default}
    .bg{background:transparent;color:#666;border:1px solid #1e1e30;border-radius:8px;padding:8px 18px;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:border-color 0.2s,color 0.2s}
    .bg:hover{border-color:#5b4aff;color:#ccc}
    .sr{border:1px solid #1e1e30;border-radius:10px;margin-bottom:10px;overflow:hidden;transition:border-color 0.2s}
    .sr.op{border-color:#5b4aff44}
    .sh{display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;user-select:none;background:#0f0f1a;transition:background 0.2s}
    .sh:hover{background:#13131f}
    .sb{padding:0 18px 18px;background:#0d0d18}
    .tag{display:inline-block;background:#1a1a2e;border:1px solid #2a2a45;border-radius:4px;padding:2px 8px;font-size:11px;color:#8888aa}
    .sp{display:inline-block;width:8px;height:8px;border-radius:50%;background:#5b4aff;animation:spp 1.2s infinite}
    @keyframes spp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
    .cb{background:#1a1a2e;border:1px solid #2a2a45;border-radius:6px;color:#8888aa;padding:5px 12px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all 0.2s}
    .cb:hover{border-color:#5b4aff;color:#ccc}.cb.ok{border-color:#22c55e55;color:#22c55e}
    .pb{background:#090912;border:1px solid #1e1e30;border-radius:8px;padding:14px;font-size:12.5px;line-height:1.7;color:#c8c6d8;white-space:pre-wrap;word-break:break-word;margin-top:12px}
    .lbl{font-size:10px;letter-spacing:0.12em;color:#5b4aff;text-transform:uppercase;margin-bottom:10px}
    .sn{width:26px;height:26px;border-radius:50%;border:1px solid #2a2a45;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;transition:background 0.2s}
  `;

  return (
    <>
      <style>{css}</style>
      <div className='wrap'>
        <div style={{ width: '100%', maxWidth: 700, marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#5b4aff', marginBottom: 8, textTransform: 'uppercase' }}>AI Prompt Agent</div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: 800, lineHeight: 1.1, background: 'linear-gradient(135deg, #e8e6f0 30%, #5b4aff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Tell me what you want to build.
          </h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 10 }}>Type or speak your requirements. I will handle the rest.</p>
        </div>

        {stage === STAGES.INPUT && (
          <div className='card'>
            <div className='lbl'>Your requirements</div>
            {listening && <div className='lb'><span className='dp' /> Listening - speak now</div>}
            <div className='tw'>
              <textarea className={listening ? 'on' : ''} placeholder='Describe what you want to build - type it or tap the mic to speak.' value={requirements} onChange={(e) => setRequirements(e.target.value)} />
              {voiceSupported && (
                <button className={'mb ' + (listening ? 'on' : 'off')} onClick={toggleVoice}>
                  {listening ? <StopIcon /> : <MicIcon />}
                </button>
              )}
            </div>
            {interim && <div className='it'>{interim}</div>}
            {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <button className='bp' onClick={submitReqs} disabled={loading || !requirements.trim()}>
              {loading ? <><span className='sp' style={{ marginRight: 8 }} />Analyzing...</> : 'Analyze Requirements'}
            </button>
          </div>
        )}

        {stage === STAGES.CLARIFYING && (
          <>
            <div className='card'>
              <div className='lbl'>Your requirements</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{requirements}</div>
            </div>
            <div className='card'>
              <div className='lbl'>Clarifying questions</div>
              <p style={{ fontSize: 12, color: '#555', marginBottom: 20 }}>Answer these so I can generate precise prompts for you.</p>
              {questions.map((q, i) => (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12.5, color: '#c8c6d8', marginBottom: 8 }}>
                    <span style={{ color: '#5b4aff', marginRight: 8 }}>{i + 1}.</span>{q}
                  </div>
                  <textarea style={{ minHeight: 'unset', padding: '10px 14px' }} rows={2} value={answers[i] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} placeholder='Your answer...' />
                </div>
              ))}
              {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className='bp' onClick={submitAnswers} disabled={loading || questions.some((_, i) => !answers[i]?.trim())}>
                  {loading ? <><span className='sp' style={{ marginRight: 8 }} />Generating...</> : 'Generate Prompts'}
                </button>
                <button className='bg' onClick={reset}>Start over</button>
              </div>
            </div>
          </>
        )}

        {stage === STAGES.GENERATING && (
          <div className='card' style={{ textAlign: 'center', padding: '48px 28px' }}>
            <div style={{ marginBottom: 16 }}><span className='sp' style={{ width: 12, height: 12 }} /></div>
            <div style={{ fontSize: 13, color: '#555' }}>Building your prompt sequence...</div>
          </div>
        )}

        {stage === STAGES.DONE && result && (
          <>
            <div className='card' style={{ borderColor: '#5b4aff22' }}>
              <div className='lbl'>Plan summary</div>
              <p style={{ fontSize: 13, color: '#c8c6d8', lineHeight: 1.7 }}>{result.summary}</p>
            </div>
            <div style={{ width: '100%', maxWidth: 700, marginBottom: 8 }}>
              <div className='lbl' style={{ marginBottom: 12 }}>{result.prompts?.length} prompts - use in order</div>
              {result.prompts?.map((p, i) => (
                <div key={i} className={'sr' + (expandedStep === i ? ' op' : '')}>
                  <div className='sh' onClick={() => setExpandedStep(expandedStep === i ? null : i)}>
                    <span className='sn' style={{ background: expandedStep === i ? '#5b4aff' : '#1a1a2e', color: expandedStep === i ? '#fff' : '#666' }}>{p.step}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e8e6f0' }}>{p.title}</div>
                      {expandedStep !== i && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{p.goal}</div>}
                    </div>
                    <span style={{ color: '#333', fontSize: 16 }}>{expandedStep === i ? '-' : '+'}</span>
                  </div>
                  {expandedStep === i && (
                    <div className='sb'>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>{p.goal}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className='tag'>Paste into any AI</span>
                        <button className={'cb' + (copied === i ? ' ok' : '')} onClick={() => copy(p.prompt, i)}>
                          {copied === i ? 'Copied' : 'Copy prompt'}
                        </button>
                      </div>
                      <div className='pb'>{p.prompt}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ width: '100%', maxWidth: 700, display: 'flex', justifyContent: 'flex-end' }}>
              <button className='bg' onClick={reset}>Start a new project</button>
            </div>
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </>
  );
}
