"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ListRestart,
  Search
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useThreadsStore } from "@/stores/threadsStore";
import { useConfigStore } from "@/stores/configStore";

export function TracesPageContent() {
  const router = useRouter();
  const { threads, pagination, isLoading, isRefetching, fetchThreads } = useThreadsStore();
  const config = useConfigStore((state) => state.config);
  const [searchQuery, setSearchQuery] = useState("");
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(false);

  useEffect(() => {
    if (config?.analyseBaseUrl) {
      fetchThreads(undefined, 1, pagination.count).finally(() => {
        setHasAttemptedInitialLoad(true);
      });
    }
  }, [config?.analyseBaseUrl, fetchThreads, pagination.count]);

  // Filter threads by search query
  const filteredThreads = threads.filter((thread) =>
    thread.threadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (thread.entityName && thread.entityName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handlePageChange = (page: number) => {
    setLocalIsLoading(true);
    fetchThreads(undefined, page, pagination.count).finally(() => setLocalIsLoading(false));
  };

  const handleCountChange = (count: number) => {
    setLocalIsLoading(true);
    fetchThreads(undefined, 1, count).finally(() => setLocalIsLoading(false));
  };

  const openTrace = (thread: (typeof threads)[number]) => {
    const resolvedAgentId = thread.agentId || thread.entityId;
    if (!resolvedAgentId) {
      return;
    }
    router.push(`/agents/${resolvedAgentId}/traces/${thread.threadId}`);
  };

  const shouldShowInitialLoader =
    !hasAttemptedInitialLoad || isLoading || (config?.analyseBaseUrl && threads.length === 0 && !isRefetching);

  const currentLoading = shouldShowInitialLoader || localIsLoading;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Traces</h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Inspect recent execution timelines, agent activity, and trace-level outcomes without drilling into raw logs first.
        </p>
      </div>
      <Card className="border-border/30 bg-card">
        <div className="border-b border-border/30 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search trace ID or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full min-w-0 pl-9 pr-4 sm:w-72"
                />
              </div>
              <Select
                value={pagination.count.toString()}
                onValueChange={(value) => handleCountChange(parseInt(value, 10))}
              >
                <SelectTrigger className="h-10 w-36">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentLoading && !isRefetching ? (
            <div className="flex items-center justify-center p-8">
              <Spinner className="h-6 w-6 border-2 text-primary" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <EmptyStateSimple
              title="No traces found"
              description={
                searchQuery
                  ? `No traces matching "${searchQuery}"`
                  : "No traces have been recorded yet. Run a test to see activity."
              }
              icon={ListRestart}
              action={
                !searchQuery && (
                  <Button variant="outline" size="sm">
                    Run Test Trace
                  </Button>
                )
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-2/50 hover:bg-surface-2/50">
                    <TableHead className="px-6 py-3">Status</TableHead>
                    <TableHead className="px-6 py-3">Agent</TableHead>
                    <TableHead className="px-6 py-3">Trace ID</TableHead>
                    <TableHead className="px-6 py-3">Timestamp</TableHead>
                    <TableHead className="px-6 py-3">Duration</TableHead>
                    <TableHead className="px-6 py-3">Events</TableHead>
                    <TableHead className="px-6 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredThreads.map((thread) => (
                    <TableRow
                      key={thread.threadId}
                      className="hover:bg-surface-2/50 cursor-pointer transition-colors"
                      onClick={() => openTrace(thread)}
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 bg-primary" />
                          <span className="capitalize text-sm font-medium text-foreground">
                            Active
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-foreground font-medium">
                        {thread.entityName || "Unknown Agent"}
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-primary">
                        {thread.threadId.substring(0, 16)}...
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        {thread.lastActivity ? formatTimestamp(thread.lastActivity) : "N/A"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-foreground">
                        {thread.duration ? formatDuration(thread.duration) : "N/A"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-foreground">
                        {thread.eventCount}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-muted-foreground hover:text-primary"
                        >
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border/30 px-6 py-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredThreads.length} of {pagination.total} traces
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={pagination.page <= 1 || currentLoading}
                    onClick={() => handlePageChange(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={!pagination.hasMore || currentLoading}
                    onClick={() => handlePageChange(pagination.page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
    </div>
  );
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
