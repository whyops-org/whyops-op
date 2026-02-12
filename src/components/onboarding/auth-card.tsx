import { ArrowRight, Chrome, Github, MailCheck, RotateCcw } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

interface AuthCardProps {
  onGithubClick?: () => void;
  onGoogleClick?: () => void;
}

export function AuthCard({ onGithubClick, onGoogleClick }: AuthCardProps) {
  const {
    email,
    setEmail,
    sendMagicLink,
    resetMagicLink,
    oauthLogin,
    status,
    error,
    resendAvailableAt,
  } = useAuthStore();
  const [submitted, setSubmitted] = React.useState(false);
  const [cooldownMs, setCooldownMs] = React.useState(0);

  const isLoading = status === "loading";
  const canSubmit = email.trim().length > 0;
  const isResendDisabled = isLoading || cooldownMs > 0;
  const isSent = status === "sent" || submitted;

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
    if (!canSubmit || isLoading) return;
    await sendMagicLink();
  };

  const handleResend = async () => {
    if (isLoading) return;
    await sendMagicLink();
  };

  const handleReset = () => {
    setSubmitted(false);
    resetMagicLink();
  };

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="relative">
        <div
          className={cn(
            "space-y-6 transition-all duration-500",
            isSent ? "pointer-events-none opacity-0 -translate-y-3" : ""
          )}
        >
          <CardHeader className="space-y-3 pb-3">
            <CardTitle>Create or log in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Continue with SSO or use your work email for a magic link.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Button
                variant="muted"
                className="w-full justify-center gap-2"
                onClick={onGithubClick ?? (() => oauthLogin("github"))}
                disabled={isLoading}
              >
                <Github className="h-4 w-4" />
                Continue with GitHub
              </Button>
              <Button
                variant="muted"
                className="w-full justify-center gap-2"
                onClick={onGoogleClick ?? (() => oauthLogin("google"))}
                disabled={isLoading}
              >
                <Chrome className="h-4 w-4" />
                Continue with Google
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                Or
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Button size="lg" onClick={handleSubmit} disabled={!canSubmit} loading={isLoading}>
                  Sign Up
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  loading={isLoading}
                >
                  Log in
                </Button>
              </div>
              <p
                className={cn(
                  "min-h-[16px] text-xs transition-opacity",
                  error ? "text-destructive opacity-100" : "opacity-0"
                )}
              >
                {error ?? ""}
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
              <span>SOC 2 compliant</span>
              <span>•</span>
              <span>End-to-end encrypted</span>
            </div>
          </CardContent>
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-center px-8 py-10 text-center transition-all duration-500",
            isSent
              ? "opacity-100 translate-y-0"
              : "pointer-events-none opacity-0 translate-y-4"
          )}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-semibold text-foreground">
            Magic link sent
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
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
