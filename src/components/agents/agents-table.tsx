"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { AGENTS_TABLE_TEXT } from "@/constants/agents";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import * as React from "react";

interface Agent {
  id: string;
  name: string;
  version: string;
  status: "active" | "warning" | "error" | "inactive";
  traces: number;
  successRate: number;
  lastActive: string;
  icon: string;
}

interface AgentsTableProps {
  agents: Agent[];
}

export function AgentsTable({ agents }: AgentsTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState(
    AGENTS_TABLE_TEXT.sortOptions[0]?.value ?? ""
  );

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              />
            </div>
            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={setSortBy}>
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
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
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
          {filteredAgents.map((agent) => (
            <TableRow key={agent.id} className="hover:bg-surface-2/50">
              <TableCell className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2">
                    <AgentIcon type={agent.icon} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {agent.version}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4">
                <Badge
                  className={cn(
                    "font-medium",
                    agent.status === "active" &&
                      "bg-primary/20 text-primary",
                    agent.status === "warning" &&
                      "bg-accent/30 text-accent-foreground",
                    agent.status === "error" &&
                      "bg-destructive/20 text-destructive",
                    agent.status === "inactive" &&
                      "bg-muted/30 text-muted-foreground"
                  )}
                >
                  {AGENTS_TABLE_TEXT.statusLabels[agent.status]}
                </Badge>
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-foreground">
                {agent.traces.toLocaleString()}
              </TableCell>
              <TableCell className="px-6 py-4">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    agent.successRate >= 95
                      ? "text-primary"
                      : agent.successRate >= 85
                      ? "text-accent-foreground"
                      : "text-destructive"
                  )}
                >
                  {agent.successRate}%
                </span>
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                {agent.lastActive}
              </TableCell>
              <TableCell className="px-6 py-4 text-right">
                <button
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={AGENTS_TABLE_TEXT.actionLabel}
                >
                  <MoreIcon />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/30 px-6 py-4">
        <p className="text-xs text-muted-foreground">
          {AGENTS_TABLE_TEXT.countLabel(
            filteredAgents.length,
            agents.length
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AgentIcon({ type }: { type: string }) {
  switch (type) {
    case "user":
      return (
        <svg
          className="h-5 w-5 text-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    case "message":
      return (
        <svg
          className="h-5 w-5 text-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      );
    case "database":
      return (
        <svg
          className="h-5 w-5 text-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      );
    case "search":
      return (
        <svg
          className="h-5 w-5 text-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case "credit-card":
      return (
        <svg
          className="h-5 w-5 text-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      );
    default:
      return null;
  }
}

function MoreIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="3" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}
