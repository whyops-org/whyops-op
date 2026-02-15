"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { Input } from "@/components/ui/input";
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
import * as React from "react";

import { useThreadsStore } from "@/stores/threadsStore";

interface RecentTracesTableProps {
  agentId: string;
}

export function RecentTracesTable({ agentId }: RecentTracesTableProps) {
  const router = useRouter();
  const { threads, pagination, isLoading, isRefetching, fetchThreads } = useThreadsStore();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [localIsLoading, setLocalIsLoading] = React.useState(false);

  useEffect(() => {
    fetchThreads(agentId, 1, pagination.count);
  }, [agentId, pagination.count, fetchThreads]);

  // Filter threads by search query
  const filteredThreads = threads.filter((thread) =>
    thread.threadId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePageChange = (page: number) => {
    setLocalIsLoading(true);
    fetchThreads(agentId, page, pagination.count).finally(() => setLocalIsLoading(false));
  };

  const handleCountChange = (count: number) => {
    setLocalIsLoading(true);
    fetchThreads(agentId, 1, count).finally(() => setLocalIsLoading(false));
  };

  const currentLoading = isLoading || localIsLoading;

  return (
    <Card className="border-border/30 bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Traces</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search trace ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-64 pl-9 pr-4"
            />
          </div>
          <Select
            value={pagination.count.toString()}
            onValueChange={(value) => handleCountChange(parseInt(value, 10))}
          >
            <SelectTrigger className="h-9 w-32">
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : filteredThreads.length === 0 ? (
        <EmptyStateSimple
          title="No traces found"
          description={
            searchQuery
              ? `No traces matching "${searchQuery}"`
              : "This agent hasn't generated any traces yet. Run a test to see activity."
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
                <TableHead className="px-6 py-3">STATUS</TableHead>
                <TableHead className="px-6 py-3">TRACE ID</TableHead>
                <TableHead className="px-6 py-3">TIMESTAMP</TableHead>
                <TableHead className="px-6 py-3">DURATION</TableHead>
                <TableHead className="px-6 py-3">EVENTS</TableHead>
                <TableHead className="px-6 py-3 text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredThreads.map((thread) => (
                <TableRow
                  key={thread.threadId}
                  className="hover:bg-surface-2/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/agents/${agentId}/traces/${thread.threadId}`)}
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="capitalize text-sm font-medium text-foreground">
                        Active
                      </span>
                    </div>
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
              <p className="text-xs text-muted-foreground">
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
