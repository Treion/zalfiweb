import { PageHeader } from "@/components/admin/shell/PageHeader";
import { listOpenInvitations, listTeam } from "@/server/admin/team";
import { requireAdmin } from "@/server/auth/session";
import { TeamView } from "./TeamView";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const admin = await requireAdmin("team.manage");
  const [members, invitations] = await Promise.all([listTeam(), listOpenInvitations()]);
  return (
    <>
      <PageHeader
        title="Team"
        description="Owners can do everything. Managers run orders, products, stock, shipping and coupons."
      />
      <TeamView meId={admin.user.id} members={members} invitations={invitations} />
    </>
  );
}
