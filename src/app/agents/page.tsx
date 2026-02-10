import { AgentsTable } from "@/components/agents/agents-table";
import { StatCard } from "@/components/agents/stat-card";
import { SuccessRateChart } from "@/components/agents/success-rate-chart";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { AGENT_DATA, CHART_DATA, STATS_DATA } from "@/constants/agents";
import { Plus, Settings } from "lucide-react";

export default function AgentsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader />

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="space-y-6 p-8">
            {/* Page Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Active State Dashboard
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Real-time monitoring for deployed autonomous agents
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="md" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configure View
                </Button>
                <Button variant="primary" size="md" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Deploy Agent
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Agents"
                value={STATS_DATA.totalAgents}
                icon={
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                }
              />
              <StatCard
                title="Active Traces"
                value={STATS_DATA.activeTraces.toLocaleString()}
                icon={
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
              />
              <StatCard
                title="Success Rate"
                value={`${STATS_DATA.successRate.value}%`}
                trend={{
                  value: STATS_DATA.successRate.trend,
                  isPositive: STATS_DATA.successRate.isPositive,
                }}
                subtitle={STATS_DATA.successRate.subtitle}
                icon={
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
              <StatCard
                title="Avg Latency"
                value={STATS_DATA.avgLatency.value}
                trend={{
                  value: STATS_DATA.avgLatency.trend,
                  isPositive: STATS_DATA.avgLatency.isPositive,
                }}
                subtitle={STATS_DATA.avgLatency.subtitle}
                icon={
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
            </div>

            {/* Chart */}
            <SuccessRateChart data={CHART_DATA} />

            {/* Agents Table */}
            <AgentsTable agents={AGENT_DATA} />
          </div>
        </main>
      </div>
    </div>
  );
}
