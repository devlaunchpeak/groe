import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { OrgProvisionDialog } from "@/components/dashboard/OrgProvisionDialog";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  users: { count: number }[];
}

type AggRow = {
  org_id: string;
  enrolled_users: number;
  avg_h_mttr_score: number | null;
  count_resilient: number;
  count_developing: number;
  count_acute: number;
};

function RAGDot({ count, color }: { count: number; color: string }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {count}
    </span>
  );
}

export default async function GroeAdminPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== "groe_admin" && user.role !== "groe_viewer")) {
    redirect("/dashboard");
  }

  const db = createAdminClient();

  const { data: orgs } = await db
    .from("orgs")
    .select("id, name, slug, is_active, created_at, users(count)")
    .order("created_at", { ascending: false })
    .returns<OrgRow[]>();

  const { data: aggregates } = await db
    .from("org_aggregates")
    .select("org_id, enrolled_users, avg_h_mttr_score, count_resilient, count_developing, count_acute");

  const aggMap = new Map<string, AggRow>(
    (aggregates ?? []).map((a: AggRow) => [a.org_id, a])
  );

  return (
    <div className="min-h-screen bg-[#F8F6F0] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-[#1C4A2E]"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            GROE Admin
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            {orgs?.length ?? 0} organisation{orgs?.length !== 1 ? "s" : ""} provisioned
          </p>
        </div>
        {user.role === "groe_admin" && <OrgProvisionDialog />}
      </div>

      {/* Org table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F6F0]">
              <th className="text-left px-5 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide">
                Organisation
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide">
                Users
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide">
                Avg H-MTTR
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide">
                RAG
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {(orgs ?? []).map((org) => {
              const agg = aggMap.get(org.id);
              const created = new Date(org.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <tr key={org.id} className="hover:bg-[#F8F6F0] transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-[#111827]">{org.name}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{org.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-[#111827]">
                    {agg?.enrolled_users ?? 0}
                  </td>
                  <td className="px-5 py-4">
                    {agg?.avg_h_mttr_score != null ? (
                      <span
                        className="font-mono font-bold text-base"
                        style={{ fontFamily: '"IBM Plex Mono", monospace' }}
                      >
                        {agg.avg_h_mttr_score}
                      </span>
                    ) : (
                      <span className="text-[#6B7280]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {agg ? (
                      <div className="flex gap-3">
                        <RAGDot count={agg.count_resilient}  color="#2D6A4F" />
                        <RAGDot count={agg.count_developing} color="#F59E0B" />
                        <RAGDot count={agg.count_acute}      color="#DC2626" />
                      </div>
                    ) : (
                      <span className="text-[#6B7280]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        org.is_active
                          ? "bg-[#F0FDF4] text-[#2D6A4F]"
                          : "bg-[#F3F4F6] text-[#6B7280]"
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: org.is_active ? "#2D6A4F" : "#9CA3AF" }}
                      />
                      {org.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[#6B7280]">{created}</td>
                </tr>
              );
            })}

            {(!orgs || orgs.length === 0) && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[#6B7280]">
                  No organisations provisioned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
