"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export function OrgProvisionDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [orgName, setOrgName] = React.useState("");
  const [orgSlug, setOrgSlug] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminFullName, setAdminFullName] = React.useState("");

  function handleOrgNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setOrgName(e.target.value);
    if (!slugEdited) setOrgSlug(slugify(e.target.value));
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugEdited(true);
    setOrgSlug(slugify(e.target.value));
  }

  function resetForm() {
    setOrgName("");
    setOrgSlug("");
    setSlugEdited(false);
    setAdminEmail("");
    setAdminFullName("");
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/groe-admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, orgSlug, adminEmail, adminFullName }),
      });

      const json = await res.json() as { error?: string };

      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          style={{ backgroundColor: "#2D6A4F", color: "#fff" }}
          className="rounded-lg hover:opacity-90"
        >
          + Provision new org
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[#1C4A2E] font-semibold text-lg">
            Provision new organisation
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <div className="text-4xl">✓</div>
            <p className="font-semibold text-[#1C4A2E]">Org created successfully</p>
            <p className="text-sm text-[#6B7280]">
              An invite email has been sent to <strong>{adminEmail}</strong>.
              They have 7 days to accept.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Org details */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                Organisation
              </legend>
              <div className="space-y-1">
                <Label htmlFor="orgName">Organisation name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={handleOrgNameChange}
                  placeholder="Acme Corp"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="orgSlug">
                  Slug{" "}
                  <span className="text-[#6B7280] font-normal text-xs">
                    (used in internal references)
                  </span>
                </Label>
                <Input
                  id="orgSlug"
                  value={orgSlug}
                  onChange={handleSlugChange}
                  placeholder="acme-corp"
                  required
                  minLength={2}
                  maxLength={50}
                  pattern="[a-z0-9-]+"
                />
              </div>
            </fieldset>

            {/* Org Admin */}
            <fieldset className="space-y-3 pt-1">
              <legend className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                Org Admin (will receive invite email)
              </legend>
              <div className="space-y-1">
                <Label htmlFor="adminFullName">Full name</Label>
                <Input
                  id="adminFullName"
                  value={adminFullName}
                  onChange={e => setAdminFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="adminEmail">Email address</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="jane@acme-corp.com"
                  required
                />
              </div>
            </fieldset>

            {error && (
              <p className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#DC2626]/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: "#2D6A4F", color: "#fff" }}
                className="rounded-lg hover:opacity-90"
              >
                {loading ? "Provisioning…" : "Create org & send invite"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
