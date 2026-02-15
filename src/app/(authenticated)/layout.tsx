import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { ConfigProvider } from "@/components/providers/config-provider";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultCollapsed = false;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar defaultCollapsed={defaultCollapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-auto bg-background">
          <ConfigProvider>
            {children}
          </ConfigProvider>
        </main>
      </div>
    </div>
  );
}
