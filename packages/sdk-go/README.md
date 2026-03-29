# `whyops-go`

Go SDK for WhyOps AI agent observability.

## Module path

```txt
github.com/whyops-org/whyops-op/packages/sdk-go
```

## Install

```bash
go get github.com/whyops-org/whyops-op/packages/sdk-go@latest
```

## Quick start

```go
package main

import (
	"context"
	"os"

	whyops "github.com/whyops-org/whyops-op/packages/sdk-go"
)

func main() {
	ctx := context.Background()

	sdk := whyops.New(whyops.Config{
		APIKey:    os.Getenv("WHYOPS_API_KEY"),
		AgentName: "support-agent",
		AgentMetadata: whyops.AgentMetadata{
			SystemPrompt: "You are a helpful support agent.",
			Tools:        []whyops.AgentTool{},
		},
	})

	trace := sdk.Trace("session-123")
	_ = trace.UserMessage(ctx, []whyops.MessageItem{
		{Role: "user", Content: "Reset my password."},
	}, whyops.UserMessageOptions{})
}
```

## Proxy mode

```go
httpClient := sdk.ProxyHTTPClient()
```

## Publish

Go packages are published by pushing a tag for the subdirectory module:

```bash
git tag packages/sdk-go/v0.1.0
git push origin packages/sdk-go/v0.1.0
```

That tag format matters because this is a module inside a monorepo.
