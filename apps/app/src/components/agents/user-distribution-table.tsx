"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
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
  Users
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useUserDistributionStore } from "@/stores/userDistributionStore";

interface UserDistributionTableProps {
  agentId: string;
}

export function UserDistributionTable({ agentId }: UserDistributionTableProps) {
  const router = useRouter();
  const { users, totals, pagination, isLoading, error, fetchUserDistribution } = useUserDistributionStore();
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (agentId) {
      void fetchUserDistribution(agentId, 1, 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handlePageChange = (page: number) => {
    setLocalLoading(true);
    void fetchUserDistribution(agentId, page, pagination.count).finally(() => setLocalLoading(false));
  };

  const handleCountChange = (count: number) => {
    setLocalLoading(true);
    void fetchUserDistribution(agentId, 1, count).finally(() => setLocalLoading(false));
  };

  const viewUserTraces = (externalUserId: string) => {
    router.push(`/agents/${agentId}?externalUserId=${encodeURIComponent(externalUserId)}`);
  };

  const currentLoading = isLoading || localLoading;

  if (isLoading && users.length === 0) {
    return (
      <Card className="border-border/30 bg-card">
        <div className="flex items-center justify-center p-8">
          <Spinner className="h-6 w-6 border-2 text-primary" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/30 bg-card">
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="border-border/30 bg-card">
        <EmptyStateSimple
          title="No user data"
          description="No traces with external user IDs have been recorded for this agent yet."
          icon={Users}
        />
      </Card>
    );
  }

  return (
    <Card className="border-border/30 bg-card">
      {totals && (
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
          <div className="flex gap-6">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Unique Users</span>
              <span className="text-lg font-semibold text-foreground">{totals.uniqueUsers}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total Traces</span>
              <span className="text-lg font-semibold text-foreground">{totals.totalTraces}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total Cost</span>
              <span className="text-lg font-semibold text-foreground">${totals.totalCost.toFixed(4)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total Tokens</span>
              <span className="text-lg font-semibold text-foreground">{totals.totalTokens.toLocaleString()}</span>
            </div>
          </div>
          <Select
            value={pagination.count.toString()}
            onValueChange={(value) => handleCountChange(parseInt(value, 10))}
          >
            <SelectTrigger className="h-8 w-28">
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
      )}
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-2/50 hover:bg-surface-2/50">
            <TableHead className="px-6 py-3">External User ID</TableHead>
            <TableHead className="px-6 py-3">Traces</TableHead>
            <TableHead className="px-6 py-3">Tokens</TableHead>
            <TableHead className="px-6 py-3">Cost</TableHead>
            <TableHead className="px-6 py-3">Errors</TableHead>
            <TableHead className="px-6 py-3">Last Active</TableHead>
            <TableHead className="px-6 py-3 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.externalUserId} className="hover:bg-surface-2/50">
              <TableCell className="px-6 py-4 font-mono text-sm text-foreground">
                {user.externalUserId}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-foreground">
                {user.traceCount}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-foreground">
                {user.totalTokens.toLocaleString()}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-foreground">
                ${user.totalCost.toFixed(4)}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm">
                {user.errorCount > 0 ? (
                  <span className="text-destructive">{user.errorCount}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                {user.lastActiveAt ? formatTimestamp(user.lastActiveAt) : "N/A"}
              </TableCell>
              <TableCell className="px-6 py-4 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => viewUserTraces(user.externalUserId)}
                >
                  View Traces <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      <div className="flex items-center justify-between border-t border-border/30 px-6 py-4">
        <p className="text-sm text-muted-foreground">
          Showing {users.length} of {pagination.total} users
        </p>
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
