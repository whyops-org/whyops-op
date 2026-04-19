export interface ToolDefinition {
  href: string;
  slug: string;
  name: string;
  summary: string;
  useCase: string;
  output: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
    priority: number;
    changeFrequency: "weekly" | "monthly";
  };
}

export const TOOLS_INDEX_DEFINITION = {
  href: "/tools",
  title: "Free AI Agent Tools",
  description:
    "Free AI agent debugging tools from WhyOps for trace replay, context drift analysis, token pricing, and loop detection.",
  keywords: [
    "free AI agent tools",
    "AI agent debugging tools",
    "agent observability tools",
    "AI run replay tool",
    "AI context drift detector",
    "AI token pricing calculator",
    "AI loop detection tool",
    "WhyOps tools",
  ],
  priority: 0.9,
  changeFrequency: "weekly" as const,
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    href: "/tools/run-autopsy",
    slug: "run-autopsy",
    name: "Run Autopsy",
    summary: "Turn pasted agent JSON into a readable trace.",
    useCase:
      "Use it when you need the exact order of messages, tool calls, and failures from one run.",
    output: "Flow view, timeline view, and parsed event counts.",
    seo: {
      title: "Run Autopsy for AI Agents",
      description:
        "Paste OpenAI, LangChain, Langfuse, or WhyOps run JSON and turn it into a readable AI agent trace with flow steps, timeline events, and failure context.",
      keywords: [
        "AI run replay",
        "AI agent trace viewer",
        "OpenAI conversation visualizer",
        "LangChain run parser",
        "Langfuse trace viewer",
        "AI agent debugging",
        "WhyOps run autopsy",
      ],
      priority: 0.8,
      changeFrequency: "weekly",
    },
  },
  {
    href: "/tools/context-rot",
    slug: "context-rot",
    name: "Context Rot Detector",
    summary: "Find the turn where instruction-following starts to drop.",
    useCase:
      "Use it when a conversation looks fine early on and gets less reliable as context grows.",
    output: "Adherence trend, dropped constraints, and a reset recommendation.",
    seo: {
      title: "Context Rot Detector for AI Agents",
      description:
        "Analyze multi-turn AI conversations and find where instruction adherence drops, constraints get ignored, and the context window starts degrading output quality.",
      keywords: [
        "context rot detector",
        "AI context degradation",
        "LLM instruction drift",
        "prompt adherence analysis",
        "AI conversation quality drop",
        "agent context window debugging",
        "WhyOps context rot detector",
      ],
      priority: 0.8,
      changeFrequency: "weekly",
    },
  },
  {
    href: "/tools/token-calculator",
    slug: "token-calculator",
    name: "Token Burn Calculator",
    summary: "Resolve live model pricing and estimate run cost.",
    useCase:
      "Use it when you need input, output, cache, and monthly spend numbers for one model.",
    output: "Structured pricing response, per-task cost, and kill-switch estimates.",
    seo: {
      title: "Token Burn Calculator for AI Models",
      description:
        "Look up AI model pricing with validation, fuzzy matching, cache pricing, context window details, and cost estimates for runs, retries, and monthly usage.",
      keywords: [
        "AI token calculator",
        "LLM pricing calculator",
        "OpenAI model pricing lookup",
        "Anthropic pricing lookup",
        "AI prompt caching cost",
        "model context window lookup",
        "WhyOps token burn calculator",
      ],
      priority: 0.85,
      changeFrequency: "weekly",
    },
  },
  {
    href: "/tools/loop-detector",
    slug: "loop-detector",
    name: "Loop Detector",
    summary: "Spot repeated tool calls and recurring failures across runs.",
    useCase:
      "Use it when an agent retries the same step, error, or tool invocation without progress.",
    output: "Loop groups, repeated errors, and optional root-cause analysis.",
    seo: {
      title: "Loop Detector for AI Agent Runs",
      description:
        "Find repeated tool calls, recurring failures, and retry loops across AI agent runs, then inspect cost burn and root-cause patterns before they escalate.",
      keywords: [
        "AI loop detector",
        "AI agent retry loop",
        "repeated tool call detector",
        "AI failure pattern analysis",
        "agent retry debugging",
        "AI incident analysis",
        "WhyOps loop detector",
      ],
      priority: 0.8,
      changeFrequency: "weekly",
    },
  },
];

export function getToolDefinitionBySlug(slug: string) {
  return TOOL_DEFINITIONS.find((tool) => tool.slug === slug);
}
