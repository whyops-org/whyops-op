import { getGoEventsSnippet, getGoProxySnippet } from "./go-snippets";
import { getHttpEventsSnippet, getHttpProxySnippet } from "./http-snippets";
import { getPythonEventsSnippet, getPythonProxySnippet } from "./python-snippets";
import { getTypeScriptEventsSnippet, getTypeScriptProxySnippet } from "./typescript-snippets";
import type { CodeSnippet, CodeSnippetConfig, CodeSnippetData, SnippetType } from "./types";

const proxyGenerators = {
  go: getGoProxySnippet,
  http: getHttpProxySnippet,
  python: getPythonProxySnippet,
  typescript: getTypeScriptProxySnippet,
} as const;

const eventGenerators = {
  go: getGoEventsSnippet,
  http: getHttpEventsSnippet,
  python: getPythonEventsSnippet,
  typescript: getTypeScriptEventsSnippet,
} as const;

export type { CodeSnippet, CodeSnippetConfig, CodeSnippetData, SnippetType } from "./types";

export function getCodeSnippet(
  language: string,
  data: CodeSnippetData,
  config: CodeSnippetConfig,
  type: SnippetType = "proxy"
): CodeSnippet {
  const generators = type === "proxy" ? proxyGenerators : eventGenerators;
  switch (language) {
    case "go":
      return generators.go(data, config);
    case "http":
      return generators.http(data, config);
    case "typescript":
      return generators.typescript(data, config);
    case "python":
    default:
      return generators.python(data, config);
  }
}
