"use client";

import { Badge } from "@/components/ui/badge";
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
import { getPlaceHolderImage } from "@/lib/helper";
import { cn } from "@/lib/utils";
import type { Agent, Pagination } from "@/types/global";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  MoreHorizontal,
  Search
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";

interface AgentsTableProps {
  agents?: Agent[];
  pagination?: Pagination | null;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onCountChange?: (count: number) => void;
}

const AGENTS_TABLE_TEXT = {
  title: "Agents List",
  searchPlaceholder: "Search agents...",
  sortPlaceholder: "Sort by",
  sortOptions: [
    { value: "last-7-days", label: "Last 7 days" },
    { value: "last-30-days", label: "Last 30 days" },
    { value: "all-time", label: "All time" },
  ],
  columns: ["Name", "Status", "Traces", "Success", "Last Active", "Actions"],
  actionColumn: "Actions",
  actionLabel: "More options",
  countLabel: (filtered: number, total: number) =>
    `Showing ${filtered} of ${total} agents`,
};

function AgentIcon({ name }: { name: string }) {
  return (
    <Image
      src={getPlaceHolderImage(name)}
      alt={`${name} avatar`}
      width={40}
      height={40}
      sizes="40px"
      className="h-full w-full object-cover"
    />
  );
}

function MoreIcon() {
  return <MoreHorizontal className="h-4 w-4" />;
}

function deriveStatus(lastActive: string): "active" | "inactive" {
  const date = new Date(lastActive);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours < 24 ? "active" : "inactive";
}

function getSuccessPercentage(
  successPercentage: number | Record<string, number> | undefined
): number {
  if (!successPercentage) return 0;
  if (typeof successPercentage === "number") return successPercentage;

  const values = Object.values(successPercentage);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / values.length);
}

function formatLastActive(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AgentsTable({
  agents = [],
  pagination = null,
  isLoading = false,
  onPageChange,
  onCountChange
}: AgentsTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const isTableLoading = Boolean(isLoading);
  // TODO: Enable sort functionality when API supports it
  // const [sortBy, setSortBy] = React.useState(
  //   AGENTS_TABLE_TEXT.sortOptions[0]?.value ?? ""
  // );

  const router = useRouter();

  const filteredAgents = agents.filter((agent: Agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrevPage = () => {
    if (pagination && pagination.page > 1 && onPageChange) {
      onPageChange(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination && pagination.hasMore && onPageChange) {
      onPageChange(pagination.page + 1);
    }
  };

  return (
    <Card className="border-border/30 bg-card">
      {/* Header */}
      <div className="border-b border-border/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {AGENTS_TABLE_TEXT.title}
          </h2>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={AGENTS_TABLE_TEXT.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-64 pl-9 pr-4"
                disabled={isTableLoading}
              />
            </div>
            {/* Sort Dropdown - TODO: Implement sort functionality */}
            {/* <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue
                  placeholder={AGENTS_TABLE_TEXT.sortPlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {AGENTS_TABLE_TEXT.sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select> */}
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredAgents.length === 0 ? (
        <EmptyStateSimple
          title="No agents found"
          description={
            searchQuery
              ? `No agents matching "${searchQuery}"`
              : "No agents deployed yet. Create your first agent to get started."
          }
          icon={Inbox}
          action={
            !searchQuery && (
              <Button variant="outline" size="sm">
                Create Agent
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-2/50">
              {AGENTS_TABLE_TEXT.columns.map((column) => (
                <TableHead
                  key={column}
                  className={cn(
                    "px-6 py-3",
                    column === AGENTS_TABLE_TEXT.actionColumn && "text-right"
                  )}
                >
                  {column === AGENTS_TABLE_TEXT.actionColumn ? (
                    <span className="sr-only">{column}</span>
                  ) : (
                    column
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAgents.map((agent: Agent) => {
              const status = deriveStatus(agent.lastActive);
              return (
                <TableRow
                  key={agent.id}
                  className="hover:bg-surface-2/50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (!isTableLoading) {
                      router.push(`/agents/${agent.id}`);
                    }
                  }}
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center overflow-hidden justify-center rounded-lg bg-surface-2">
                        <AgentIcon name={agent.name} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {agent.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {agent.latestVersion?.hash?.substring(0, 8) || "v1.0.0"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      className={cn(
                        "font-medium",
                        status === "active" && "bg-primary/20 text-primary",
                        status === "inactive" && "bg-muted/30 text-muted-foreground"
                      )}
                    >
                      {status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-foreground">
                    {agent.traceCount?.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {(() => {
                      const successRate = getSuccessPercentage(agent.successPercentage);
                      return (
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            successRate >= 95
                              ? "text-primary"
                              : successRate >= 85
                              ? "text-accent-foreground"
                              : "text-destructive"
                          )}
                        >
                          {successRate}%
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                    {formatLastActive(agent.lastActive)}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <button
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={AGENTS_TABLE_TEXT.actionLabel}
                      disabled={isTableLoading}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreIcon />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Footer */}
      {filteredAgents.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/30 px-6 py-4">
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              {AGENTS_TABLE_TEXT.countLabel(
                filteredAgents.length,
                pagination?.total ?? agents.length
              )}
            </p>
            {/* Count selector */}
            <Select
              value={pagination?.count?.toString() ?? "20"}
              onValueChange={(value) => onCountChange?.(parseInt(value, 10))}
              disabled={isTableLoading}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isTableLoading || !pagination || pagination.page <= 1}
              onClick={handlePrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isTableLoading || !pagination || !pagination.hasMore}
              onClick={handleNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
