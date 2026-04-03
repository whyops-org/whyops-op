"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  Search,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useThreadsStore } from "@/stores/threadsStore";

interface RecentTracesTableProps {
  agentId: string;
}

export function RecentTracesTable({ agentId }: RecentTracesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { threads, pagination, isLoading, isRefetching, fetchThreads, setExternalUserIdFilter } = useThreadsStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [localIsLoading, setLocalIsLoading] = useState(false);

  const externalUserIdFilter = searchParams.get("externalUserId");

  useEffect(() => {
    if (externalUserIdFilter) {
      setExternalUserIdFilter(externalUserIdFilter);
    } else {
      setExternalUserIdFilter(null);
    }
    void fetchThreads(agentId, 1, pagination.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, externalUserIdFilter]);

  // Filter threads by search query (client-side for trace ID search)
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

  const clearExternalUserIdFilter = () => {
    setExternalUserIdFilter(null);
    setSearchQuery("");
    router.push(`/agents/${agentId}`);
  };

  const currentLoading = isLoading || localIsLoading;

  return (
    <Card className="border-border/30 bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-6 py-4 flex-wrap gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <h2 className="text-lg font-semibold text-foreground shrink-0">Recent Traces</h2>
          {externalUserIdFilter && (
            <div className="flex items-center gap-2 rounded-sm border border-border/60 bg-surface-2/30 px-3 py-1 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">User:</span>
              <span className="max-w-32 truncate font-mono text-xs text-foreground">
                {externalUserIdFilter}
              </span>
              <button
                onClick={clearExternalUserIdFilter}
                className="ml-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search trace ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-48 pl-9 pr-4 sm:w-64"
            />
          </div>
          <Select
            value={pagination.count.toString()}
            onValueChange={(value) => handleCountChange(parseInt(value, 10))}
          >
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue placeholder="Per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="20">20 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
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
              : externalUserIdFilter
              ? `No traces found for user "${externalUserIdFilter}"`
              : "This agent hasn't generated any traces yet. Run a test to see activity."
          }
          icon={ListRestart}
          action={
            !searchQuery && !externalUserIdFilter && (
              <Button variant="outline" size="sm">
                Run Test Trace
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2/50 hover:bg-surface-2/50">
                <TableHead className="px-6 py-3">Status</TableHead>
                {externalUserIdFilter && <TableHead className="px-6 py-3">External User</TableHead>}
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
                  onClick={() => router.push(`/agents/${agentId}/traces/${thread.threadId}`)}
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 bg-primary" />
                      <span className="capitalize text-sm font-medium text-foreground">
                        Active
                      </span>
                    </div>
                  </TableCell>
                  {externalUserIdFilter && (
                    <TableCell className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {thread.externalUserId || "—"}
                    </TableCell>
                  )}
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
                      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

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
