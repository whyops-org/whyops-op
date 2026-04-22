import { ChevronRight, Github, MailCheck, RotateCcw } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

interface AuthCardProps {
  onGithubClick?: () => void;
}

export function AuthCard({ onGithubClick }: AuthCardProps) {
  const {
    email,
    setEmail,
    sendMagicLink,
    resetMagicLink,
    oauthLogin,
    status,
    oauthLoadingProvider,
    error,
    resendAvailableAt,
  } = useAuthStore();
  const [submitted, setSubmitted] = React.useState(false);
  const [cooldownMs, setCooldownMs] = React.useState(0);

  const isLoading = status === "loading";
  const isGithubLoading = oauthLoadingProvider === "github";
  const isBusy = isLoading || isGithubLoading;
  const canSubmit = email.trim().length > 0;
  const isResendDisabled = isBusy || cooldownMs > 0;
  const isSent = status === "sent" || submitted;

  // Show error as toast notification
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  React.useEffect(() => {
    if (!resendAvailableAt) {
      setCooldownMs(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(resendAvailableAt - Date.now(), 0);
      setCooldownMs(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [resendAvailableAt]);

  React.useEffect(() => {
    if (status === "sent") {
      setSubmitted(true);
    }
  }, [status]);

  const handleSubmit = async () => {
    if (!canSubmit || isBusy) return;
    await sendMagicLink();
  };

  const handleResend = async () => {
    if (isBusy) return;
    await sendMagicLink();
  };

  const handleReset = () => {
    setSubmitted(false);
    resetMagicLink();
  };

  return (
    <Card className="w-full max-w-[440px] overflow-hidden border-border/50 bg-card">
      <div className="relative">
        <div
          className={cn(
            "space-y-6 transition-all duration-300",
            isSent ? "pointer-events-none opacity-0" : ""
          )}
        >
          <CardHeader className="space-y-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="text-xl sm:text-2xl">Sign in to WhyOps</CardTitle>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Continue with GitHub or request a sign-in link for your work email.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 px-5 pb-5 sm:px-6 sm:pb-6 sm:space-y-7">
            <div className="space-y-3">
              <Button
                variant="muted"
                className="w-full justify-center gap-2"
                onClick={onGithubClick ?? (() => void oauthLogin("github"))}
                loading={isGithubLoading}
                disabled={isBusy}
              >
                <Github className="h-4 w-4" />
                Continue with GitHub
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-sm text-muted-foreground">
                or use email
              </span>
              <Separator className="flex-1" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  placeholder="name@company.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button size="lg" className="w-full" onClick={handleSubmit} disabled={!canSubmit || isBusy} loading={isLoading}>
                Email me a sign-in link
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-4 border-t border-border/50 pt-5 text-sm text-muted-foreground">
              <span>End-to-end encrypted</span>
            </div>
          </CardContent>
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-center px-8 py-10 text-center transition-all duration-300",
            isSent
              ? "opacity-100 translate-y-0"
              : "pointer-events-none opacity-0 translate-y-4"
          )}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-semibold text-foreground sm:text-2xl">
            Magic link sent
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            We sent a secure sign-in link to {email || "your email"}. Use that
            link to finish signing in.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="muted" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Use another email
            </Button>
            <Button onClick={handleResend} disabled={isResendDisabled} loading={isLoading}>
              {cooldownMs > 0
                ? `Resend in ${Math.ceil(cooldownMs / 1000)}s`
                : "Resend email"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
