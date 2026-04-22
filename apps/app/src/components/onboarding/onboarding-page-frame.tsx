import { SiteHeader } from "@/components/layout/site-header";

interface OnboardingPageFrameProps {
  children: React.ReactNode;
  mainClassName?: string;
}

export function OnboardingPageFrame({
  children,
  mainClassName = "flex-1 min-h-0 overflow-auto px-4 sm:px-5 lg:px-10",
}: OnboardingPageFrameProps) {
  return (
    <div className="min-h-dvh bg-grid">
      <div className="flex min-h-dvh flex-col">
        <SiteHeader actionLabel="Log out" />
        <main className={mainClassName}>{children}</main>
      </div>
    </div>
  );
}
