import { EmptyState } from "@/components/dashboard/empty-state";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardPage() {
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
          <EmptyState />
        </main>
      </div>
    </div>
  );
}
