"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ChevronDownIcon,
  PrinterIcon,
  RefreshCwIcon,
  SendIcon,
  TruckIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { formatPrice } from "@/lib/money";
import {
  cancelShipmentAction,
  pathaoPlacesAction,
  refreshShipmentAction,
  sendToCourierAction,
  simulateCourierAction,
} from "../../shipping/actions";

type Option = { name: "mock" | "pathao" | "steadfast"; label: string; mode: string };
type Place = { id: number; name: string };

/** "Send to courier": choose the courier (Pathao also needs its city and zone) and send */
export function SendToCourier({
  orderId,
  number,
  couriers,
  defaultCourier,
  cod,
}: {
  orderId: number;
  number: string;
  couriers: Option[];
  defaultCourier: string;
  cod: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<Option["name"] | undefined>(
    (couriers.find((c) => c.name === defaultCourier) ?? couriers[0])?.name,
  );
  const [cities, setCities] = useState<Place[]>([]);
  const [zones, setZones] = useState<Place[]>([]);
  const [cityId, setCityId] = useState<number | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Pathao: load its cities and zones, with the address's own picked
  useEffect(() => {
    if (!open || name !== "pathao") return;
    let live = true;
    void pathaoPlacesAction({ orderId }).then((r) => {
      if (!live) return;
      if (!r.ok) return setLookupError(r.error);
      setCities(r.data.cities);
      setZones(r.data.zones);
      setCityId(r.data.cityId);
      setZoneId(r.data.zoneId);
    });
    return () => {
      live = false;
    };
  }, [open, name, orderId]);

  function chooseCity(id: number) {
    setCityId(id);
    setZoneId(null);
    void pathaoPlacesAction({ orderId, cityId: id }).then((r) => {
      if (r.ok) {
        setZones(r.data.zones);
        setZoneId(r.data.zoneId);
      }
    });
  }

  if (!couriers.length)
    return (
      <p className="text-muted-foreground text-xs">
        No courier is set up yet. Add Pathao or Steadfast keys (see docs/guides/deploy-vercel.md).
      </p>
    );

  const ready = !!name && (name !== "pathao" || (!!cityId && !!zoneId));
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <SendIcon /> Send to courier
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Send ${number}`}</DialogTitle>
            <DialogDescription>
              {cod
                ? `The courier collects ${formatPrice(cod)} in cash on delivery.`
                : "Paid online: the courier collects nothing."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="send-courier">Courier</Label>
              <Select value={name} onValueChange={(v) => setName(v as Option["name"])}>
                <SelectTrigger id="send-courier" className="w-full">
                  <SelectValue>
                    {couriers.find((c) => c.name === name)?.label ?? "Choose a courier"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.label}
                      {c.mode !== "live" ? ` (${c.mode})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {name === "pathao" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pathao-city">Pathao city</Label>
                  <Select
                    value={cityId ? String(cityId) : undefined}
                    onValueChange={(v) => chooseCity(Number(v))}
                  >
                    <SelectTrigger id="pathao-city" className="w-full">
                      <SelectValue placeholder="Choose">
                        {cities.find((c) => c.id === cityId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pathao-zone">Pathao zone</Label>
                  <Select
                    value={zoneId ? String(zoneId) : undefined}
                    onValueChange={(v) => setZoneId(Number(v))}
                  >
                    <SelectTrigger id="pathao-zone" className="w-full">
                      <SelectValue placeholder="Choose">
                        {zones.find((z) => z.id === zoneId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={String(z.id)}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {lookupError && (
                  <p className="text-destructive col-span-2 text-xs">{lookupError}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button
              disabled={!ready || pending}
              onClick={() =>
                start(async () => {
                  const r = await sendToCourierAction({
                    id: orderId,
                    courier: name,
                    ...(name === "pathao" && cityId && zoneId
                      ? { pathao: { cityId, zoneId } }
                      : {}),
                  });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`Sent: consignment ${r.data.consignmentId}`);
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              <TruckIcon /> {pending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const STEPS: { status: string; label: string }[] = [
  { status: "picked_up", label: "Picked up" },
  { status: "in_transit", label: "On the way" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
  { status: "delivery_failed", label: "Delivery failed" },
  { status: "returning", label: "On its way back" },
  { status: "returned", label: "Returned to you" },
];

/** The parcel's own buttons: label, check status, cancel before pickup, and the test courier */
export function ShipmentActions({
  orderId,
  shipmentId,
  mock,
  underWay,
  canCancel,
  courierLabel,
}: {
  orderId: number;
  shipmentId: number;
  mock: boolean;
  /** Still with the courier: updates can still come (none once delivered or back) */
  underWay: boolean;
  canCancel: boolean;
  courierLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [done, setDone] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <a
          href={`/api/admin/shipping/labels?ids=${orderId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <PrinterIcon /> Label
        </a>
      </Button>
      {!mock && underWay && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => refreshShipmentAction({ shipmentId }), "Status checked")}
        >
          <RefreshCwIcon /> Check
        </Button>
      )}
      {mock && underWay && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              Courier update <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Play the test courier</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STEPS.map((s) => (
              <DropdownMenuItem
                key={s.status}
                onSelect={() =>
                  run(
                    () => simulateCourierAction({ shipmentId, status: s.status }),
                    `Courier: ${s.label.toLowerCase()}`,
                  )
                }
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canCancel && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setCancelOpen(true)}
        >
          <XCircleIcon /> Cancel parcel
        </Button>
      )}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this parcel?</DialogTitle>
            <DialogDescription>
              {mock
                ? "The test courier drops it at once. The order stays packed, ready to send again."
                : `${courierLabel} cancels parcels in its own panel. Cancel it there first, then confirm here. The order stays packed, ready to send again.`}
            </DialogDescription>
          </DialogHeader>
          {!mock && (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={done} onCheckedChange={(v) => setDone(!!v)} className="mt-0.5" />
              {`I've cancelled it in the ${courierLabel} panel`}
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={pending || (!mock && !done)}
              onClick={() => {
                setCancelOpen(false);
                run(
                  () => cancelShipmentAction({ shipmentId, confirmed: done }),
                  "Parcel cancelled",
                );
              }}
            >
              Cancel parcel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
