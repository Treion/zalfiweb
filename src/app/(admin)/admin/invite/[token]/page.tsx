import { Logo } from "@/components/brand/Logo";
import { findInvitation } from "@/server/admin/team";
import { AcceptForm } from "./AcceptForm";

export const metadata = { title: "Join the team" };

export default async function InvitePage({ params }: PageProps<"/admin/invite/[token]">) {
  const { token } = await params;
  const inv = await findInvitation(token);
  return (
    <main id="main" className="grid min-h-svh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <Logo variant="full" title="ZALFI" className="h-16 w-auto" />
          <p className="eyebrow">Admin</p>
        </div>
        {inv ? (
          <>
            <h1 className="font-display mb-1 text-2xl">Join the ZALFI team</h1>
            <p className="text-muted-foreground mb-6 text-sm">
              You&rsquo;re invited as a <strong className="text-foreground">{inv.role}</strong> with{" "}
              <strong className="text-foreground">{inv.email}</strong>. Choose your name and a
              password.
            </p>
            <AcceptForm token={token} />
          </>
        ) : (
          <div className="text-center">
            <h1 className="font-display mb-2 text-2xl">This link has expired</h1>
            <p className="text-muted-foreground text-sm">
              Invitation links work once, for 48 hours. Ask the owner to send a new one.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
