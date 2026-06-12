"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Step = "email" | "code";

interface LoginFormProps {
  initialStep: Step;
  initialError: string | null;
}

export function LoginForm({ initialStep, initialError }: LoginFormProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  // -------------------------------------------------------------------------
  // SSO: redirect the user to WorkOS for SAML/OIDC auth
  // -------------------------------------------------------------------------
  function handleSso(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Enter your work email to continue with SSO.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const { message } = (await res.json()) as { message: string };
        setError(message ?? "SSO initiation failed. Try again.");
        return;
      }

      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    });
  }

  // -------------------------------------------------------------------------
  // Magic auth: send 6-digit OTP to email
  // -------------------------------------------------------------------------
  function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Enter your work email to receive a sign-in code.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/auth/magic-link/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const { message } = (await res.json()) as { message: string };
        setError(message ?? "Could not send code. Try again.");
        return;
      }

      setStep("code");
    });
  }

  // -------------------------------------------------------------------------
  // Magic auth: verify the OTP code
  // -------------------------------------------------------------------------
  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const { message } = (await res.json()) as { message: string };
        setError(message ?? "Invalid or expired code. Please try again.");
        return;
      }

      const { redirectTo } = (await res.json()) as { redirectTo: string };
      window.location.href = redirectTo;
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card>
      <CardHeader className="pb-4">
        {step === "email" ? (
          <>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use your organization SSO or receive a sign-in code by email.
            </CardDescription>
          </>
        ) : (
          <>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-[#111827]">{email}</span>.
              Enter it below to sign in.
            </CardDescription>
          </>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "email" ? (
          <>
            {/* Shared email input — used by both SSO and magic auth */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@yourcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Enterprise SSO */}
            <form onSubmit={handleSso}>
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
                aria-label="Sign in with enterprise SSO"
              >
                {isPending ? "Redirecting…" : "Continue with SSO"}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-[#6B7280] font-body shrink-0">or</span>
              <Separator className="flex-1" />
            </div>

            {/* Magic auth (email OTP) */}
            <form onSubmit={handleSendCode}>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isPending}
                aria-label="Sign in with email code"
              >
                {isPending ? "Sending…" : "Send sign-in code"}
              </Button>
            </form>
          </>
        ) : (
          /* Code entry step */
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                disabled={isPending}
                className="tracking-widest text-center text-lg font-mono"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || code.length !== 6}
            >
              {isPending ? "Verifying…" : "Verify code"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="w-full text-sm text-[#6B7280] hover:text-[#2D6A4F] transition-colors"
            >
              ← Use a different email
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
