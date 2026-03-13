import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';

const logger = createServiceLogger('analyse:eval:intelligence');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface IntelligenceFragment {
  source: 'linkup' | 'hn' | 'github' | 'reddit' | 'twitter';
  type: 'discussion' | 'issue' | 'competitor' | 'failure_report' | 'best_practice' | 'general';
  title: string;
  content: string;
  url?: string;
  score?: number;
  date?: string;
}

export interface IntelligenceGatherResult {
  fragments: IntelligenceFragment[];
  sourcesUsed: string[];
  sourcesSkipped: string[];
  totalFragments: number;
}

// ---------------------------------------------------------------------------
// Linkup Provider (primary web search)
// ---------------------------------------------------------------------------
async function fetchLinkup(queries: string[]): Promise<IntelligenceFragment[]> {
  const apiKey = env.LINKUP_API_KEY;
  if (!apiKey) return [];

  const fragments: IntelligenceFragment[] = [];

  for (const query of queries.slice(0, 5)) {
    try {
      const response = await fetch('https://api.linkup.so/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          depth: 'standard',
          outputType: 'searchResults',
          includeImages: false,
          includeSources: true,
        }),
      });

      if (!response.ok) {
        logger.warn({ status: response.status, query }, 'Linkup search failed');
        continue;
      }

      const data = (await response.json()) as any;
      const results = data.results || data.searchResults || [];

      for (const result of (Array.isArray(results) ? results : []).slice(0, 5)) {
        fragments.push({
          source: 'linkup',
          type: 'general',
          title: result.title || result.name || query,
          content: result.content || result.snippet || result.description || '',
          url: result.url || result.link,
        });
      }
    } catch (error) {
      logger.warn({ error, query }, 'Linkup search error');
    }
  }

  return fragments;
}

// ---------------------------------------------------------------------------
// Hacker News Algolia Provider (zero auth)
// ---------------------------------------------------------------------------
interface HNHit {
  objectID: string;
  title?: string;
  story_text?: string;
  comment_text?: string;
  url?: string;
  author: string;
  points?: number;
  num_comments?: number;
  created_at: string;
}

async function fetchHackerNews(queries: string[]): Promise<IntelligenceFragment[]> {
  const fragments: IntelligenceFragment[] = [];

  for (const query of queries.slice(0, 3)) {
    try {
      const url = new URL('https://hn.algolia.com/api/v1/search');
      url.searchParams.set('query', query);
      url.searchParams.set('tags', 'story');
      url.searchParams.set('hitsPerPage', '10');
      url.searchParams.set('numericFilters', 'points>5');

      const response = await fetch(url.toString());
      if (!response.ok) continue;

      const data = (await response.json()) as { hits: HNHit[] };

      for (const hit of data.hits.slice(0, 5)) {
        fragments.push({
          source: 'hn',
          type: 'discussion',
          title: hit.title || query,
          content: hit.story_text || `${hit.title} (${hit.points} points, ${hit.num_comments} comments)`,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          score: hit.points,
          date: hit.created_at,
        });
      }

      // Also fetch top comments for top stories
      for (const hit of data.hits.slice(0, 2)) {
        try {
          const commentsUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${hit.objectID}&hitsPerPage=5`;
          const commentsResp = await fetch(commentsUrl);
          if (!commentsResp.ok) continue;
          const commentsData = (await commentsResp.json()) as { hits: HNHit[] };

          for (const comment of commentsData.hits) {
            if (comment.comment_text && comment.comment_text.length > 50) {
              fragments.push({
                source: 'hn',
                type: 'discussion',
                title: `Comment on: ${hit.title}`,
                content: comment.comment_text.slice(0, 1000),
                url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
                date: comment.created_at,
              });
            }
          }
        } catch {
          // skip comment fetch failures
        }
      }
    } catch (error) {
      logger.warn({ error, query }, 'HN search error');
    }
  }

  return fragments;
}

// ---------------------------------------------------------------------------
// GitHub Provider
// ---------------------------------------------------------------------------
async function fetchGitHub(queries: string[]): Promise<IntelligenceFragment[]> {
  const token = env.GITHUB_TOKEN;
  if (!token) return [];

  const fragments: IntelligenceFragment[] = [];
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  for (const query of queries.slice(0, 3)) {
    try {
      // Search repositories
      const repoResp = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query + ' AI agent')}&sort=stars&order=desc&per_page=5`,
        { headers }
      );

      if (!repoResp.ok) {
        logger.warn({ status: repoResp.status }, 'GitHub repo search failed');
        continue;
      }

      const repoData = (await repoResp.json()) as any;

      for (const repo of (repoData.items || []).slice(0, 3)) {
        fragments.push({
          source: 'github',
          type: 'competitor',
          title: repo.full_name,
          content: `${repo.description || ''} (${repo.stargazers_count} stars, ${repo.open_issues_count} open issues)`,
          url: repo.html_url,
          score: repo.stargazers_count,
        });

        // Fetch bug issues for top repos
        try {
          const issuesResp = await fetch(
            `https://api.github.com/search/issues?q=repo:${repo.full_name}+is:issue+label:bug+state:open&sort=reactions&order=desc&per_page=5`,
            { headers }
          );

          if (issuesResp.ok) {
            const issuesData = (await issuesResp.json()) as any;
            for (const issue of (issuesData.items || []).slice(0, 3)) {
              fragments.push({
                source: 'github',
                type: 'issue',
                title: `[${repo.full_name}] ${issue.title}`,
                content: (issue.body || '').slice(0, 800),
                url: issue.html_url,
                score: issue.reactions?.total_count,
                date: issue.created_at,
              });
            }
          }
        } catch {
          // skip issue fetch failures
        }
      }
    } catch (error) {
      logger.warn({ error, query }, 'GitHub search error');
    }
  }

  return fragments;
}

// ---------------------------------------------------------------------------
// Reddit Provider (OAuth2)
// ---------------------------------------------------------------------------
let redditToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) return null;

  if (redditToken && Date.now() < redditToken.expiresAt) {
    return redditToken.token;
  }

  try {
    const credentials = Buffer.from(
      `${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`
    ).toString('base64');

    const body = env.REDDIT_USERNAME && env.REDDIT_PASSWORD
      ? `grant_type=password&username=${encodeURIComponent(env.REDDIT_USERNAME)}&password=${encodeURIComponent(env.REDDIT_PASSWORD)}`
      : 'grant_type=client_credentials';

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'whyops-intel/1.0',
      },
      body,
    });

    if (!response.ok) return null;
    const data = (await response.json()) as any;

    redditToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return redditToken.token;
  } catch (error) {
    logger.warn({ error }, 'Reddit auth failed');
    return null;
  }
}

async function fetchReddit(queries: string[]): Promise<IntelligenceFragment[]> {
  const token = await getRedditToken();
  if (!token) return [];

  const fragments: IntelligenceFragment[] = [];
  const subreddits = ['LocalLLaMA', 'MachineLearning', 'artificial', 'ChatGPT', 'LangChain'];

  for (const query of queries.slice(0, 3)) {
    try {
      // Global search
      const response = await fetch(
        `https://oauth.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=10&sort=relevance&t=month`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'whyops-intel/1.0',
          },
        }
      );

      if (!response.ok) continue;
      const data = (await response.json()) as any;

      for (const post of (data?.data?.children || []).slice(0, 5)) {
        const d = post.data;
        fragments.push({
          source: 'reddit',
          type: d.selftext?.toLowerCase().includes('bug') || d.selftext?.toLowerCase().includes('fail')
            ? 'failure_report'
            : 'discussion',
          title: d.title,
          content: (d.selftext || '').slice(0, 1000) || d.title,
          url: `https://reddit.com${d.permalink}`,
          score: d.score,
          date: new Date(d.created_utc * 1000).toISOString(),
        });
      }
    } catch (error) {
      logger.warn({ error, query }, 'Reddit search error');
    }
  }

  // Also search specific subreddits
  for (const sub of subreddits.slice(0, 2)) {
    try {
      const response = await fetch(
        `https://oauth.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(queries[0] || '')}&restrict_sr=on&limit=5&sort=top&t=month`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'whyops-intel/1.0',
          },
        }
      );

      if (!response.ok) continue;
      const data = (await response.json()) as any;

      for (const post of (data?.data?.children || []).slice(0, 3)) {
        const d = post.data;
        fragments.push({
          source: 'reddit',
          type: 'discussion',
          title: `[r/${sub}] ${d.title}`,
          content: (d.selftext || '').slice(0, 800) || d.title,
          url: `https://reddit.com${d.permalink}`,
          score: d.score,
        });
      }
    } catch {
      // skip subreddit failures
    }
  }

  return fragments;
}

// ---------------------------------------------------------------------------
// Twitter/X Provider
// ---------------------------------------------------------------------------
async function fetchTwitter(queries: string[]): Promise<IntelligenceFragment[]> {
  const token = env.TWITTER_BEARER_TOKEN;
  if (!token) return [];

  const fragments: IntelligenceFragment[] = [];

  for (const query of queries.slice(0, 2)) {
    try {
      const searchQuery = `${query} -is:retweet lang:en`;
      const url = new URL('https://api.x.com/2/tweets/search/recent');
      url.searchParams.set('query', searchQuery);
      url.searchParams.set('max_results', '10');
      url.searchParams.set('tweet.fields', 'created_at,public_metrics,text');
      url.searchParams.set('sort_order', 'relevancy');

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Twitter search failed');
        continue;
      }

      const data = (await response.json()) as any;

      for (const tweet of (data.data || []).slice(0, 5)) {
        fragments.push({
          source: 'twitter',
          type: 'discussion',
          title: tweet.text.slice(0, 100),
          content: tweet.text,
          score: tweet.public_metrics?.like_count,
          date: tweet.created_at,
        });
      }
    } catch (error) {
      logger.warn({ error, query }, 'Twitter search error');
    }
  }

  return fragments;
}

// ---------------------------------------------------------------------------
// Public API — gather from all configured sources
// ---------------------------------------------------------------------------
export async function gatherIntelligence(queries: string[]): Promise<IntelligenceGatherResult> {
  const providers: Array<{
    name: string;
    isConfigured: () => boolean;
    fetch: (q: string[]) => Promise<IntelligenceFragment[]>;
  }> = [
    { name: 'linkup', isConfigured: () => !!env.LINKUP_API_KEY, fetch: fetchLinkup },
    { name: 'hn', isConfigured: () => true, fetch: fetchHackerNews },
    { name: 'github', isConfigured: () => !!env.GITHUB_TOKEN, fetch: fetchGitHub },
    { name: 'reddit', isConfigured: () => !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET), fetch: fetchReddit },
    { name: 'twitter', isConfigured: () => !!env.TWITTER_BEARER_TOKEN, fetch: fetchTwitter },
  ];

  const configured = providers.filter((p) => p.isConfigured());
  const skipped = providers.filter((p) => !p.isConfigured()).map((p) => p.name);

  logger.info(
    {
      configured: configured.map((p) => p.name),
      skipped,
      queryCount: queries.length,
    },
    'Starting intelligence gathering'
  );

  // Fan out all configured providers in parallel
  const results = await Promise.allSettled(
    configured.map(async (provider) => {
      const start = Date.now();
      const fragments = await provider.fetch(queries);
      logger.info(
        { provider: provider.name, fragments: fragments.length, durationMs: Date.now() - start },
        'Provider completed'
      );
      return fragments;
    })
  );

  const allFragments: IntelligenceFragment[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allFragments.push(...result.value);
    }
  }

  logger.info(
    { totalFragments: allFragments.length, sourcesUsed: configured.map((p) => p.name) },
    'Intelligence gathering completed'
  );

  return {
    fragments: allFragments,
    sourcesUsed: configured.map((p) => p.name),
    sourcesSkipped: skipped,
    totalFragments: allFragments.length,
  };
}
