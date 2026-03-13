import { createServiceLogger } from '@whyops/shared/logger';
import { Agent, Entity, Trace } from '@whyops/shared/models';
import { segmentPrompt, type PromptBlock } from '../../langchain/utils/prompt-segmenter';
import type { ToolDefinition } from '../../langchain/utils/tool-relevance-filter';

const logger = createServiceLogger('analyse:eval:profile-extractor');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AgentProfile {
  name: string;
  agentId: string;
  entityId?: string;
  systemPrompt: {
    fullText: string;
    segments: PromptBlock[];
  };
  tools: ToolDefinition[];
  constraints: string[];
  persona: string;
  domains: string[];
  capabilities: string[];
}

interface ExtractProfileInput {
  agentId: string;
  userId: string;
  projectId: string;
  environmentId: string;
}

// ---------------------------------------------------------------------------
// Constraint extraction patterns
// ---------------------------------------------------------------------------
const CONSTRAINT_PATTERNS = [
  /(?:you must not|do not|never|don't|must never|should not|shouldn't|avoid|refrain from|prohibited from)\s+(.+?)(?:\.|$)/gi,
  /(?:always|you must|you should|ensure|make sure)\s+(.+?)(?:\.|$)/gi,
];

const PERSONA_PATTERNS = [
  /you are (?:a |an )?(.+?)(?:\.|,|$)/i,
  /act as (?:a |an )?(.+?)(?:\.|,|$)/i,
  /your role is (?:to be )?(?:a |an )?(.+?)(?:\.|,|$)/i,
  /persona:\s*(.+?)(?:\n|$)/i,
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  customer_support: ['support', 'help desk', 'customer service', 'ticket', 'issue resolution', 'complaint'],
  coding_assistant: ['code', 'programming', 'developer', 'software', 'debug', 'repository', 'git'],
  data_analysis: ['data', 'analytics', 'visualization', 'dashboard', 'metrics', 'report'],
  sales: ['sales', 'lead', 'prospect', 'crm', 'pipeline', 'deal', 'revenue'],
  content_creation: ['content', 'writing', 'blog', 'article', 'copy', 'marketing'],
  healthcare: ['medical', 'health', 'patient', 'diagnosis', 'treatment', 'clinical'],
  finance: ['financial', 'trading', 'investment', 'banking', 'payment', 'accounting'],
  education: ['learning', 'teaching', 'course', 'student', 'curriculum', 'education'],
  legal: ['legal', 'law', 'compliance', 'regulation', 'contract', 'policy'],
  ecommerce: ['product', 'order', 'cart', 'checkout', 'inventory', 'shipping'],
  hr: ['hr', 'hiring', 'recruitment', 'employee', 'onboarding', 'payroll'],
  general_assistant: ['assistant', 'help', 'question', 'answer', 'chat'],
};

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------
function extractConstraints(text: string): string[] {
  const constraints: string[] = [];
  for (const pattern of CONSTRAINT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const constraint = match[0].trim();
      if (constraint.length > 10 && constraint.length < 500) {
        constraints.push(constraint);
      }
    }
  }
  return [...new Set(constraints)];
}

function extractPersona(text: string): string {
  for (const pattern of PERSONA_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().slice(0, 200);
    }
  }
  return 'general assistant';
}

function detectDomains(text: string, tools: ToolDefinition[]): string[] {
  const combined = [text, ...tools.map((t) => `${t.name} ${t.description || ''}`)].join(' ').toLowerCase();
  const detected: Array<{ domain: string; score: number }> = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.reduce((s, kw) => s + (combined.includes(kw) ? 1 : 0), 0);
    if (score >= 2) {
      detected.push({ domain, score });
    }
  }

  detected.sort((a, b) => b.score - a.score);
  return detected.length > 0 ? detected.map((d) => d.domain) : ['general_assistant'];
}

function extractCapabilities(tools: ToolDefinition[], promptSegments: PromptBlock[]): string[] {
  const capabilities: string[] = [];

  for (const tool of tools) {
    const desc = tool.description || tool.name.replace(/[_-]/g, ' ');
    capabilities.push(`Can ${desc.charAt(0).toLowerCase()}${desc.slice(1)}`);
  }

  for (const segment of promptSegments) {
    if (segment.name === 'policy' || segment.name === 'role') {
      const lines = segment.content.split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'));
      for (const line of lines.slice(0, 10)) {
        const clean = line.replace(/^[\s\-*]+/, '').trim();
        if (clean.length > 10 && clean.length < 200) {
          capabilities.push(clean);
        }
      }
    }
  }

  return capabilities.slice(0, 30);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function extractAgentProfile(input: ExtractProfileInput): Promise<AgentProfile> {
  const { agentId, userId, projectId, environmentId } = input;

  const agent = await Agent.findOne({
    where: { id: agentId, userId, projectId, environmentId },
  });

  if (!agent) {
    throw new Error('AGENT_NOT_FOUND');
  }

  // Get the latest entity (agent version) for system prompt + tools
  const entity = await Entity.findOne({
    where: { agentId, userId, projectId, environmentId },
    order: [['createdAt', 'DESC']],
  });

  let systemPromptText = '';
  let tools: ToolDefinition[] = [];

  if (entity?.metadata) {
    systemPromptText = entity.metadata.systemPrompt || entity.metadata.system_prompt || '';
    tools = entity.metadata.tools || [];
  }

  // Fallback: check latest trace for system prompt + tools if entity metadata is sparse
  if (!systemPromptText || tools.length === 0) {
    const latestTrace = await Trace.findOne({
      where: { entityId: entity?.id },
      order: [['createdAt', 'DESC']],
    });

    if (latestTrace) {
      if (!systemPromptText && latestTrace.systemMessage) {
        systemPromptText = latestTrace.systemMessage;
      }
      if (tools.length === 0 && latestTrace.tools) {
        tools = Array.isArray(latestTrace.tools) ? latestTrace.tools : [];
      }
    }
  }

  const segmentation = await segmentPrompt(systemPromptText || '');

  const constraints = extractConstraints(systemPromptText);
  const persona = extractPersona(systemPromptText);
  const domains = detectDomains(systemPromptText, tools);
  const capabilities = extractCapabilities(tools, segmentation.blocks);

  logger.info(
    {
      agentId,
      agentName: agent.name,
      toolCount: tools.length,
      constraintCount: constraints.length,
      domains,
      promptSegments: segmentation.blocks.length,
    },
    'Agent profile extracted'
  );

  return {
    name: agent.name,
    agentId,
    entityId: entity?.id,
    systemPrompt: {
      fullText: systemPromptText,
      segments: segmentation.blocks,
    },
    tools,
    constraints,
    persona,
    domains,
    capabilities,
  };
}
