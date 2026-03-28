package whyops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// retryDelays and retryableStatuses are defined in config_gen.go

type httpClient struct {
	inner *http.Client
}

func newHTTPClient() *httpClient {
	return &httpClient{inner: &http.Client{Timeout: HTTPTimeoutMs * time.Millisecond}}
}

func (c *httpClient) post(ctx context.Context, url string, body any, headers map[string]string) (int, []byte, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return 0, nil, fmt.Errorf("whyops: marshal: %w", err)
	}

	var lastStatus int
	var lastErr error

	for attempt := 0; attempt <= len(retryDelays); attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return 0, nil, ctx.Err()
			case <-time.After(retryDelays[attempt-1]):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
		if err != nil {
			return 0, nil, fmt.Errorf("whyops: new request: %w", err)
		}
	req.Header.Set(HeaderContentType, HeaderContentJSON)
		for k, v := range headers {
			req.Header.Set(k, v)
		}

		resp, err := c.inner.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		lastStatus = resp.StatusCode
		if !retryableStatuses[resp.StatusCode] {
			return resp.StatusCode, respBody, nil
		}
		lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	if lastErr != nil {
		return lastStatus, nil, lastErr
	}
	return lastStatus, nil, fmt.Errorf("whyops: post failed after retries")
}
