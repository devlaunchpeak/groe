import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { workos } from "@/lib/workos/client";
import { SESSION_COOKIE_NAME } from "@/lib/workos/session";
import { LoginForm } from "./_components/LoginForm";

interface LoginPageProps {
  searchParams: { step?: string; error?: string };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // If the user already has a valid session, send them to their dashboard
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const session = workos.userManagement.loadSealedSession({
        sessionData: sessionCookie,
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
      });
      const { authenticated } = await session.authenticate();
      if (authenticated) redirect("/dashboard");
    } catch {
      // Corrupt cookie — fall through to login form
    }
  }

  const step = searchParams.step === "code" ? "code" : "email";
  const error = searchParams.error ?? null;

  return (
    <main className="min-h-screen bg-[#F8F6F0] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1C4A2E]">
            <span className="text-white font-heading font-bold text-xl">G</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-[#111827]">
            GROE Resilience Platform
          </h1>
          <p className="text-sm text-[#6B7280] font-body">
            Sign in to your organization&apos;s account
          </p>
        </div>

        <LoginForm initialStep={step} initialError={error} />

        <p className="text-center text-xs text-[#6B7280] font-body">
          Access is by invitation only.{" "}
          <span className="text-[#2D6A4F]">Contact your Org Admin</span> if you
          need access.
        </p>
      </div>
    </main>
  );
}
