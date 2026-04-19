import { SiteHeader } from "@/components/layout/site-header";

interface OnboardingPageFrameProps {
  children: React.ReactNode;
  mainClassName?: string;
}

export function OnboardingPageFrame({
  children,
  mainClassName = "flex-1 overflow-hidden px-5 lg:px-10",
}: OnboardingPageFrameProps) {
  return (
    <div className="min-h-screen bg-grid">
      <div className="flex h-screen flex-col">
        <SiteHeader actionLabel="Log out" />
        <main className={mainClassName}>{children}</main>
      </div>
    </div>
  );
}
