"use client";

import {
  CopyIcon,
  MailIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { formatDateTime, formatRelative } from "@/lib/time";
import { inviteAction, revokeInviteAction, setActiveAction, setRoleAction } from "./actions";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager";
  active: boolean;
  lastLoginAt: Date | null;
  twoFactorEnabled: boolean;
};
type Invitation = { id: number; email: string; role: "owner" | "manager"; expiresAt: Date };

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"manager" | "owner">("manager");
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    start(async () => {
      const res = await inviteAction({ email: String(form.get("email") ?? ""), role });
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data);
      toast.success("Invitation created");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to the team</DialogTitle>
          <DialogDescription>
            They get a link to create their account. It works once, for 48 hours.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {result.emailed
                ? "We emailed this link. You can also copy it:"
                : "Copy this link and send it to them:"}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={result.url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Invitation link"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy link"
                onClick={() =>
                  navigator.clipboard.writeText(result.url).then(() => toast.success("Link copied"))
                }
              >
                <CopyIcon />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "manager" | "owner")}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                <MailIcon /> {pending ? "Inviting…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberActions({ m }: { m: Member }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else toast.success(done);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${m.name}`}
            disabled={pending}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              run(
                () =>
                  setRoleAction({ userId: m.id, role: m.role === "owner" ? "manager" : "owner" }),
                `${m.name} is now ${m.role === "owner" ? "a manager" : "an owner"}`,
              )
            }
          >
            Make {m.role === "owner" ? "manager" : "owner"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {m.active ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                run(
                  () => setActiveAction({ userId: m.id, active: true }),
                  `${m.name} can sign in again`,
                )
              }
            >
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {m.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are signed out everywhere at once and can&rsquo;t sign in until reactivated.
              Their history stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                run(
                  () => setActiveAction({ userId: m.id, active: false }),
                  `${m.name} is deactivated`,
                )
              }
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TeamView({
  meId,
  members,
  invitations,
}: {
  meId: string;
  members: Member[];
  invitations: Invitation[];
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Members</CardTitle>
          <CardDescription>{members.filter((m) => m.active).length} active</CardDescription>
          <div data-slot="card-action">
            <InviteDialog />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="w-12 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-5">
                    <div className="font-medium">
                      {m.name}{" "}
                      {m.id === meId && (
                        <span className="text-muted-foreground font-normal">(you)</span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">{m.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={m.role === "owner" ? "progress" : "neutral"}
                      className="capitalize"
                    >
                      {m.role === "owner" && <ShieldCheckIcon />} {m.role}
                    </Badge>
                    {m.twoFactorEnabled && (
                      <Badge variant="outline" className="ml-1.5">
                        2FA
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.active ? "success" : "danger"}>
                      {m.active ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell title={m.lastLoginAt ? formatDateTime(m.lastLoginAt) : undefined}>
                    {m.lastLoginAt ? (
                      formatRelative(m.lastLoginAt)
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {m.id !== meId && <MemberActions m={m} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Open invitations</CardTitle>
            <CardDescription>Waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableBody>
                {invitations.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="pl-5">{i.email}</TableCell>
                    <TableCell className="capitalize">{i.role}</TableCell>
                    <TableCell className="text-muted-foreground">
                      Expires {formatDateTime(i.expiresAt)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await revokeInviteAction({ id: i.id });
                            if (res.ok) toast.success("Invitation withdrawn");
                            else toast.error(res.error);
                          })
                        }
                      >
                        Withdraw
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
