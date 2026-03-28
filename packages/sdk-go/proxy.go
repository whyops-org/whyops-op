package whyops

import (
	"net/http"
)

// WhyOpsTransport is an http.RoundTripper that injects WhyOps proxy headers
// into every request. Wrap your existing *http.Client with it.
type WhyOpsTransport struct {
	// Inner is the underlying transport. Defaults to http.DefaultTransport.
	Inner     http.RoundTripper
	apiKey    string
	agentName string
}

func (t *WhyOpsTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Clone the request to avoid mutating the original
	clone := req.Clone(req.Context())
	clone.Header.Set("Authorization", "Bearer "+t.apiKey)
	clone.Header.Set(HeaderAgentName, t.agentName)

	inner := t.Inner
	if inner == nil {
		inner = http.DefaultTransport
	}
	return inner.RoundTrip(clone)
}

// ProxyHTTPClient returns an *http.Client whose transport injects WhyOps
// proxy headers. Pass this client to any OpenAI/Anthropic Go SDK that
// accepts a custom *http.Client.
//
// Example:
//
//	httpClient := sdk.ProxyHTTPClient()
//	openaiClient := openai.NewClient("sk-...", option.WithHTTPClient(httpClient))
func (c *Client) ProxyHTTPClient() *http.Client {
	return &http.Client{
		Transport: &WhyOpsTransport{
			Inner:     http.DefaultTransport,
			apiKey:    c.apiKey,
			agentName: c.agentName,
		},
	}
}
