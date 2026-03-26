# Trace Event Handlers

This directory contains a scalable event handling system for trace events. Each event type has its own handler that provides data for three different views:

1. **Canvas** - The main flow visualization (ReactFlow nodes)
2. **Sidebar** - The details panel (right sidebar)
3. **Timeline** - The timeline view

## Adding a New Event Type

To add support for a new event type:

### Step 1: Create a Handler File

Create a new file in `handlers/` directory with the naming convention: `{event-type}.handler.ts`

```typescript
// handlers/my-event.handler.ts
import type { EventHandler, CanvasNodeData, SidebarData, TimelineData } from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

export const MyEventHandler: EventHandler = {
  eventType: "my_event",  // The event type from the API

  nodeConfig: {
    nodeType: "myCustomNode",  // ReactFlow node type
    label: "My Event",         // Display label
    highlight: true,           // Whether to highlight this node
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
    // Return data for the canvas/flow view
    return {
      label: this.nodeConfig.label,
      eventType: event.eventType,
      content: event.content,
      metadata: event.metadata,
      stepId: event.stepId,
      parentStepId: event.parentStepId ?? null,
      spanId: event.spanId ?? null,
      timestamp: event.timestamp,
      duration: event.duration ?? null,
      timeSinceStart: event.timeSinceStart ?? 0,
      isLateEvent: event.isLateEvent ?? false,
      contentText: "Extracted text for display",
      contentPreview: "Short preview",
      truncated: false,
      nodeType: this.nodeConfig.nodeType,
      highlight: this.nodeConfig.highlight ?? false,
    };
  },

  getSidebarData(event: TraceEvent): SidebarData {
    // Return data for the right sidebar
    return {
      title: "My Event",
      subtitle: `Step ${event.stepId}`,
      sections: [
        {
          title: "Content",
          type: "text",  // "text" | "json" | "table" | "metrics" | "code"
          content: "Content to display",
          collapsible: true,
          defaultOpen: true,
        },
      ],
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    // Return data for the timeline view
    return {
      title: "My Event",
      description: "Short description",
      icon: "star",  // Icon name
      status: "completed",  // "pending" | "running" | "completed" | "error"
      timestamp: event.timestamp,
      duration: event.duration ?? undefined,
      metadata: event.metadata,
    };
  },

  // Optional: Control whether this event should be displayed
  shouldDisplay(event: TraceEvent): boolean {
    return true;
  },
};
```

### Step 2: Register the Handler

Import and register your handler in `registry.ts`:

```typescript
import { MyEventHandler } from "./handlers/my-event.handler";

// In the registerBuiltInHandlers method:
this.register(MyEventHandler);
```

### Step 3: Create a Custom Node Component (Optional)

If you need a custom visualization, create a node component in `custom-nodes.tsx`:

```typescript
// custom-nodes.tsx
export function MyCustomNode({ data }: { data: TraceNodeData }) {
  return (
    <div className="custom-node">
      {/* Your custom rendering */}
    </div>
  );
}
```

Then register it in `trace-canvas.tsx`:

```typescript
const nodeTypes = {
  myCustomNode: MyCustomNode,
  // ... other node types
};
```

## Data Types

### CanvasNodeData
Data for ReactFlow canvas nodes:
- `label`: Display label
- `contentText`: Full text content
- `contentPreview`: Short preview
- `truncated`: Whether content was truncated
- `nodeType`: ReactFlow node type
- `highlight`: Whether to highlight the node

### SidebarData
Data for the right sidebar panel:
- `title`: Main title
- `subtitle`: Secondary info
- `sections`: Array of sections with different content types

### SidebarSection Types
- `text`: Plain text content
- `json`: JSON object with syntax highlighting
- `table`: Array of objects as a table
- `metrics`: Key-value metrics
- `code`: Code block with syntax highlighting

### TimelineData
Data for the timeline view:
- `title`: Event title
- `description`: Short description
- `icon`: Icon name
- `status`: pending/running/completed/error
- `timestamp`: Event timestamp
- `duration`: Event duration in ms
- `metadata`: Additional metadata

## Usage

```typescript
import { 
  convertEventsToNodesAndEdges,
  getEventSidebarData,
  getEventTimelineData,
  eventHandlerRegistry 
} from "@/lib/trace-utils";

// For canvas
const { nodes, edges } = convertEventsToNodesAndEdges(events);

// For sidebar
const sidebarData = getEventSidebarData(selectedEvent);

// For timeline
const timelineData = events.map(getEventTimelineData);

// Check if event should be displayed
if (eventHandlerRegistry.shouldDisplay(event)) {
  // Process event
}
```

## Handler File Structure

```
trace-events/
├── index.ts              # Public exports
├── types.ts              # Type definitions
├── registry.ts           # Handler registry
└── handlers/
    ├── user-message.handler.ts
    ├── llm-response.handler.ts
    ├── tool-call.handler.ts
    ├── tool-result.handler.ts
    ├── error-message.handler.ts
    ├── agent-message.handler.ts
    ├── system-message.handler.ts
    └── my-event.handler.ts  # Your new handler
```
