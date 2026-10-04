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
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { formatPrice } from "@/lib/money";
import { COURIER_LABELS, OTHER_COURIERS, type CourierName } from "@/server/shipping/types";
import {
  cancelShipmentAction,
  carrybeePlacesAction,
  manualStatusAction,
  pathaoPlacesAction,
  redxPlacesAction,
  refreshShipmentAction,
  sendToCourierAction,
  simulateCourierAction,
} from "../../shipping/actions";

type Option = { name: CourierName; label: string; mode: string };
type Place = { id: number; name: string };

/**
 * "Send to courier": choose the courier and send. Pathao and CarryBee also need their city and
 * zone, RedX its delivery area; "Other courier" takes the courier's name, tracking number and link.
 */
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
  const [areas, setAreas] = useState<Place[]>([]);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [other, setOther] = useState({ courierName: "", trackingCode: "", trackingUrl: "" });
  const [pending, start] = useTransition();

  // RedX: the delivery areas in the customer's district, with the address's own picked
  useEffect(() => {
    if (!open || name !== "redx") return;
    let live = true;
    void redxPlacesAction({ orderId }).then((r) => {
      if (!live) return;
      if (!r.ok) return setLookupError(r.error);
      setAreas(r.data.areas);
      setAreaId(r.data.areaId);
    });
    return () => {
      live = false;
    };
  }, [open, name, orderId]);

  // Pathao and CarryBee: load the courier's cities and zones, with the address's own picked
  const cityZone = name === "pathao" || name === "carrybee";
  const placesAction = name === "carrybee" ? carrybeePlacesAction : pathaoPlacesAction;
  useEffect(() => {
    if (!open || (name !== "pathao" && name !== "carrybee")) return;
    let live = true;
    void (name === "carrybee" ? carrybeePlacesAction : pathaoPlacesAction)({ orderId }).then(
      (r) => {
        if (!live) return;
        if (!r.ok) return setLookupError(r.error);
        setCities(r.data.cities);
        setZones(r.data.zones);
        setCityId(r.data.cityId);
        setZoneId(r.data.zoneId);
      },
    );
    return () => {
      live = false;
    };
  }, [open, name, orderId]);

  // A new courier starts from a clean choice of places (Pathao's and CarryBee's ids differ)
  function chooseCourier(v: string) {
    setName(v as Option["name"]);
    setLookupError(null);
    setCities([]);
    setZones([]);
    setCityId(null);
    setZoneId(null);
    setAreas([]);
    setAreaId(null);
  }

  function chooseCity(id: number) {
    setCityId(id);
    setZoneId(null);
    void placesAction({ orderId, cityId: id }).then((r) => {
      if (r.ok) {
        setZones(r.data.zones);
        setZoneId(r.data.zoneId);
      }
    });
  }

  if (!couriers.length)
    return (
      <p className="text-muted-foreground text-xs">
        No courier is on. Set one up in Admin → Integrations (or switch on &ldquo;Other
        courier&rdquo;).
      </p>
    );

  const linkOk = !other.trackingUrl.trim() || /^https:\/\/\S+$/.test(other.trackingUrl.trim());
  const ready =
    !!name &&
    (!cityZone || (!!cityId && !!zoneId)) &&
    (name !== "redx" || !!areaId) &&
    (name !== "manual" || (other.courierName.trim().length >= 2 && linkOk));
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
                : "Paid already: the courier collects nothing."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="send-courier">Courier</Label>
              <Select value={name} onValueChange={chooseCourier}>
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
            {cityZone && name && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="courier-city">{COURIER_LABELS[name]} city</Label>
                  <Select
                    value={cityId ? String(cityId) : undefined}
                    onValueChange={(v) => chooseCity(Number(v))}
                  >
                    <SelectTrigger id="courier-city" className="w-full">
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
                  <Label htmlFor="courier-zone">{COURIER_LABELS[name]} zone</Label>
                  <Select
                    value={zoneId ? String(zoneId) : undefined}
                    onValueChange={(v) => setZoneId(Number(v))}
                  >
                    <SelectTrigger id="courier-zone" className="w-full">
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
            {name === "redx" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="redx-area">RedX delivery area</Label>
                <Select
                  value={areaId ? String(areaId) : undefined}
                  onValueChange={(v) => setAreaId(Number(v))}
                >
                  <SelectTrigger id="redx-area" className="w-full">
                    <SelectValue placeholder="Choose">
                      {areas.find((a) => a.id === areaId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lookupError && <p className="text-destructive text-xs">{lookupError}</p>}
              </div>
            )}
            {name === "manual" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="other-name">Courier or rider</Label>
                  <Input
                    id="other-name"
                    list="other-couriers"
                    maxLength={60}
                    placeholder="Sundarban Courier, Own rider…"
                    value={other.courierName}
                    onChange={(e) => setOther((o) => ({ ...o, courierName: e.target.value }))}
                  />
                  <datalist id="other-couriers">
                    {OTHER_COURIERS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="other-code">Tracking number (optional)</Label>
                    <Input
                      id="other-code"
                      maxLength={60}
                      value={other.trackingCode}
                      onChange={(e) => setOther((o) => ({ ...o, trackingCode: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="other-link">Tracking link (optional)</Label>
                    <Input
                      id="other-link"
                      type="url"
                      maxLength={300}
                      placeholder="https://"
                      value={other.trackingUrl}
                      onChange={(e) => setOther((o) => ({ ...o, trackingUrl: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  {linkOk
                    ? "The customer's tracking button opens the link. You move the parcel along from this page."
                    : "The tracking link must start with https://"}
                </p>
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
                    ...(name === "carrybee" && cityId && zoneId
                      ? { carrybee: { cityId, zoneId } }
                      : {}),
                    ...(name === "redx" && areaId
                      ? {
                          redx: {
                            areaId,
                            areaName: areas.find((a) => a.id === areaId)?.name ?? "",
                          },
                        }
                      : {}),
                    ...(name === "manual"
                      ? {
                          manual: {
                            courierName: other.courierName.trim(),
                            trackingCode: other.trackingCode.trim() || null,
                            trackingUrl: other.trackingUrl.trim() || null,
                          },
                        }
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

/**
 * The parcel's own buttons: label, check status, cancel before pickup, and for the test courier or
 * another courier tracked by hand, the status updates
 */
export function ShipmentActions({
  orderId,
  shipmentId,
  mock,
  manual,
  cancelsHere,
  underWay,
  canCancel,
  courierLabel,
}: {
  orderId: number;
  shipmentId: number;
  mock: boolean;
  /** Another courier, tracked by the team: its updates are recorded here */
  manual: boolean;
  /** Cancelling needs no step in the courier's own panel (test courier, by hand, RedX's API) */
  cancelsHere: boolean;
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
      {!mock && !manual && underWay && (
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
      {manual && underWay && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              Update status <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{courierLabel} reports</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STEPS.map((s) => (
              <DropdownMenuItem
                key={s.status}
                onSelect={() =>
                  run(
                    () => manualStatusAction({ shipmentId, status: s.status }),
                    `Recorded: ${s.label.toLowerCase()}`,
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
              {cancelsHere
                ? `${courierLabel} drops it. The order stays packed, ready to send again.`
                : `${courierLabel} cancels parcels in its own panel. Cancel it there first, then confirm here. The order stays packed, ready to send again.`}
            </DialogDescription>
          </DialogHeader>
          {!cancelsHere && (
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
              disabled={pending || (!cancelsHere && !done)}
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
