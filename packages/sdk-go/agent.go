package whyops

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
)

type agentRegistry struct {
	mu             sync.Mutex
	cache          map[string]*AgentInfo
	apiKey         string
	proxyBaseURL   string
	analyseBaseURL string
	http           *httpClient
}

func newAgentRegistry(apiKey, proxyBaseURL, analyseBaseURL string) *agentRegistry {
	return &agentRegistry{
		cache:          make(map[string]*AgentInfo),
		apiKey:         apiKey,
		proxyBaseURL:   proxyBaseURL,
		analyseBaseURL: analyseBaseURL,
		http:           newHTTPClient(),
	}
}

func (r *agentRegistry) ensure(ctx context.Context, agentName string, metadata AgentMetadata) *AgentInfo {
	key := agentName + ":" + stableJSON(metadata)

	r.mu.Lock()
	if info, ok := r.cache[key]; ok {
		r.mu.Unlock()
		return info
	}
	r.mu.Unlock()

	info := r.init(ctx, agentName, metadata)
	if info != nil {
		r.mu.Lock()
		r.cache[key] = info
		r.mu.Unlock()
	}
	return info
}

func (r *agentRegistry) init(ctx context.Context, agentName string, metadata AgentMetadata) *AgentInfo {
	// Ensure tools is always an array (backend requires it)
	tools := metadata.Tools
	if tools == nil {
		tools = []AgentTool{}
	}
	body := map[string]any{
		"agentName": agentName,
		"metadata": map[string]any{
			"systemPrompt": metadata.SystemPrompt,
			"description":  metadata.Description,
			"tools":        tools,
		},
	}
	headers := map[string]string{"Authorization": "Bearer " + r.apiKey}

	urls := []string{
		r.analyseBaseURL + "/entities/init",
		r.proxyBaseURL + "/v1/agents/init",
	}

	for _, url := range urls {
		status, data, err := r.http.post(ctx, url, body, headers)
		if err != nil || status < 200 || status >= 300 {
			continue
		}

		var resp struct {
			AgentID        string `json:"agentId"`
			AgentVersionID string `json:"agentVersionId"`
			Status         string `json:"status"`
			VersionHash    string `json:"versionHash"`
		}
		if err := json.Unmarshal(data, &resp); err != nil || resp.AgentID == "" {
			continue
		}

		return &AgentInfo{
			AgentID:        resp.AgentID,
			AgentVersionID: resp.AgentVersionID,
			Status:         resp.Status,
			VersionHash:    resp.VersionHash,
		}
	}

	log.Println("[whyops] agent init failed — continuing without registration")
	return nil
}

func stableJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(b)
}
