/**
 * BRITUME model router.
 * Model IDs are environment-configurable so the provider catalogue can change
 * without editing application code. Routing is intentionally conservative:
 * ordinary requests stay on the low-cost model.
 */
const COMPLEX_PATTERNS = [
  /\b(debug|refactor|architect|architecture|algorithm|optimi[sz]e|security audit|threat model|production-ready|system design)\b/i,
  /\b(prove|derive|multi[- ]step|deep analysis|compare the evidence|root cause)\b/i,
  /\b(write|build|create|implement)\b.{0,80}\b(api|backend|database|application|app|compiler|framework|authentication|deployment)\b/i,
];

const BALANCED_PATTERNS = [
  /\b(explain in detail|step by step|analy[sz]e|evaluate|compare|plan|outline|summari[sz]e this document|review this code)\b/i,
  /\b(homework|assignment|essay|report|proposal|lesson plan|spreadsheet)\b/i,
];

export function chooseModel(text, env = process.env) {
  const prompt = String(text || '').trim();
  const complex = COMPLEX_PATTERNS.some((pattern) => pattern.test(prompt)) || prompt.length > 5000;
  const balanced = BALANCED_PATTERNS.some((pattern) => pattern.test(prompt)) || prompt.length > 1400;

  if (complex) return { tier: 'complex', model: env.AI_MODEL_COMPLEX || env.AI_MODEL_BALANCED || env.AI_MODEL || 'gpt-6.2-sol' };
  if (balanced) return { tier: 'balanced', model: env.AI_MODEL_BALANCED || env.AI_MODEL || 'gpt-6.1-terra' };
  return { tier: 'economy', model: env.AI_MODEL_ECONOMY || env.AI_MODEL || 'gpt-6-luna' };
}
