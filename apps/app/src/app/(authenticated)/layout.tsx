import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ConfigProvider } from "@/components/providers/config-provider";
import { ConfirmationDialogProvider } from "@/components/ui/confirmation-dialog-provider";
import { cookies } from "next/headers";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const serverCookies = await cookies();
  const defaultCollapsed = serverCookies.get("sidebar:state")?.value === "true";

  return (
    <DashboardShell defaultCollapsed={defaultCollapsed}>
      <ConfigProvider>
        <ConfirmationDialogProvider>{children}</ConfirmationDialogProvider>
      </ConfigProvider>
    </DashboardShell>
  );
}
