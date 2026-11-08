"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAdminShippingConfiguration,
  getAdminShippingReport,
  getSellerWarehouse,
  saveAdminShippingConfiguration,
  saveSellerWarehouse,
  updateActualCourierCost,
} from "@/actions/shipping";
import type { WarehouseInput } from "@/actions/shipping";
import type { ShippingConfig, ShippingZone } from "@/lib/shipping";
import { LocationPicker, type SelectedLocation } from "@/components/LocationPicker";
import { Card, Input, Label } from "@/components/ui/shared";

const EMPTY_CONFIG: ShippingConfig = {
  enabled: false,
  baseFee: 0,
  distanceRatePerKm: 0,
  weightRatePerKg: 0,
  handlingFee: 0,
  remoteSurcharge: 0,
  fallbackFee: null,
  minimumFee: 0,
  maximumFee: null,
  volumetricDivisor: null,
  weightSlabs: [],
  estimatedMinDays: 3,
  estimatedMaxDays: 7,
  zones: [],
  courierRateCards: [],
};

function parseCodes(value: string) {
  return [...new Set(value.split(/[\s,]+/).map((code) => code.trim()).filter(Boolean))];
}

function NumberField({
  label,
  value,
  onChange,
  nullable = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  nullable?: boolean;
}) {
  return (
    <label className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value ?? ""}
        placeholder={nullable ? "Not set" : "0"}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" && nullable ? null : Number(next));
        }}
      />
    </label>
  );
}

export function AdminShippingView() {
  const [config, setConfig] = useState<ShippingConfig>(EMPTY_CONFIG);
  const [version, setVersion] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof getAdminShippingReport>>>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    const [active, report] = await Promise.all([
      getAdminShippingConfiguration(),
      getAdminShippingReport(),
    ]);
    return { active, report };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const { active, report } = await fetchData();
      setVersion(active?.version ?? null);
      setConfig(active?.config ?? EMPTY_CONFIG);
      setSnapshots(report);
    } catch (loadError) {
      console.error("Could not load shipping management data:", loadError);
      setError("Shipping management data could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    void fetchData().then(({ active, report }) => {
      if (cancelled) return;
      setVersion(active?.version ?? null);
      setConfig(active?.config ?? EMPTY_CONFIG);
      setSnapshots(report);
    }).catch((loadError: unknown) => {
      if (cancelled) return;
      console.error("Could not load shipping management data:", loadError);
      setError("Shipping management data could not be loaded.");
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const updateConfig = <K extends keyof ShippingConfig>(key: K, value: ShippingConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const updateZone = (index: number, patch: Partial<ShippingZone>) => {
    setConfig((current) => ({
      ...current,
      zones: current.zones.map((zone, zoneIndex) => zoneIndex === index ? { ...zone, ...patch } : zone),
    }));
  };

  const addZone = () => updateConfig("zones", [
    ...config.zones,
    { name: "", pinCodes: [], remotePinCodes: [] },
  ]);

  const saveConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await saveAdminShippingConfiguration(config);
      if (!result.success) {
        setError(result.error || "Shipping configuration could not be saved.");
        return;
      }
      setVersion(result.version ?? null);
      await refresh();
    } catch (saveError: unknown) {
      console.error("Could not save shipping configuration:", saveError);
      setError("Shipping configuration could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (busy) return <p className="py-12 text-center text-sm text-muted-foreground">Loading shipping configuration…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3321]">Shipping &amp; Logistics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Versioned server-side delivery rules. Checkout is blocked when no explicit serviceable PIN-zone or valid route fallback exists.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Active configuration version: {version ?? "Not configured"}</p>
      </div>

      <form onSubmit={saveConfig} className="space-y-5">
        <Card className="space-y-5 p-6">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={config.enabled} onChange={(event) => updateConfig("enabled", event.target.checked)} />
            Enable shipping quotes and require serviceability checks
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField label="Base delivery fee (₹)" value={config.baseFee} onChange={(value) => updateConfig("baseFee", value ?? 0)} />
            <NumberField label="Per-kilometre charge (₹)" value={config.distanceRatePerKm} onChange={(value) => updateConfig("distanceRatePerKm", value ?? 0)} />
            <NumberField label="Per-kilogram charge (₹)" value={config.weightRatePerKg} onChange={(value) => updateConfig("weightRatePerKg", value ?? 0)} />
            <NumberField label="Handling fee (₹)" value={config.handlingFee} onChange={(value) => updateConfig("handlingFee", value ?? 0)} />
            <NumberField label="Minimum delivery fee (₹)" value={config.minimumFee} onChange={(value) => updateConfig("minimumFee", value ?? 0)} />
            <NumberField label="Maximum delivery fee (₹, optional)" value={config.maximumFee} nullable onChange={(value) => updateConfig("maximumFee", value)} />
            <NumberField label="Remote-area surcharge (₹)" value={config.remoteSurcharge} onChange={(value) => updateConfig("remoteSurcharge", value ?? 0)} />
            <NumberField label="PIN-zone route fallback fee (₹, optional)" value={config.fallbackFee} nullable onChange={(value) => updateConfig("fallbackFee", value)} />
            <NumberField label="Volumetric divisor (optional)" value={config.volumetricDivisor} nullable onChange={(value) => updateConfig("volumetricDivisor", value)} />
            <NumberField label="Estimated minimum days" value={config.estimatedMinDays} onChange={(value) => updateConfig("estimatedMinDays", value ?? 0)} />
            <NumberField label="Estimated maximum days" value={config.estimatedMaxDays} onChange={(value) => updateConfig("estimatedMaxDays", value ?? 0)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Road distance comes from the configured road-routing provider. A missing route uses only the explicit PIN-zone fallback above; no straight-line estimate is used.
          </p>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#1a3321]">Weight slabs</h2>
              <p className="text-xs text-muted-foreground">Optional fixed fees by billable weight; slabs must continuously cover 0 kg onward.</p>
            </div>
            <button type="button" className="rounded-lg border px-3 py-2 text-xs font-semibold" onClick={() => updateConfig("weightSlabs", [...config.weightSlabs, { minWeightKg: config.weightSlabs.at(-1)?.maxWeightKg ?? 0, maxWeightKg: null, fee: 0 }])}>
              Add slab
            </button>
          </div>
          {config.weightSlabs.map((slab, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <NumberField label="Minimum kg" value={slab.minWeightKg} onChange={(value) => {
                const next = [...config.weightSlabs]; next[index] = { ...slab, minWeightKg: value ?? 0 }; updateConfig("weightSlabs", next);
              }} />
              <NumberField label="Maximum kg (blank = no limit)" value={slab.maxWeightKg} nullable onChange={(value) => {
                const next = [...config.weightSlabs]; next[index] = { ...slab, maxWeightKg: value }; updateConfig("weightSlabs", next);
              }} />
              <NumberField label="Slab fee (₹)" value={slab.fee} onChange={(value) => {
                const next = [...config.weightSlabs]; next[index] = { ...slab, fee: value ?? 0 }; updateConfig("weightSlabs", next);
              }} />
              <button type="button" className="self-end rounded-lg px-3 py-2 text-xs text-red-600" onClick={() => updateConfig("weightSlabs", config.weightSlabs.filter((_, slabIndex) => slabIndex !== index))}>Remove</button>
            </div>
          ))}
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#1a3321]">Serviceable PIN zones</h2>
              <p className="text-xs text-muted-foreground">Only PIN codes explicitly listed in an enabled zone can be checked out.</p>
            </div>
            <button type="button" className="rounded-lg border px-3 py-2 text-xs font-semibold" onClick={addZone}>Add zone</button>
          </div>
          {config.zones.map((zone, index) => (
            <div key={index} className="space-y-3 rounded-xl border p-4">
              <div className="flex gap-3">
                <Input aria-label="Zone name" placeholder="Zone name" value={zone.name} onChange={(event) => updateZone(index, { name: event.target.value })} />
                <button type="button" className="px-3 text-xs text-red-600" onClick={() => updateConfig("zones", config.zones.filter((_, zoneIndex) => zoneIndex !== index))}>Remove</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold">Serviceable PIN codes
                  <textarea className="min-h-20 w-full rounded-lg border p-2 text-sm font-normal" placeholder="560001, 560002" value={zone.pinCodes.join(", ")} onChange={(event) => updateZone(index, { pinCodes: parseCodes(event.target.value) })} />
                </label>
                <label className="space-y-1 text-xs font-semibold">Remote PIN codes (must also be serviceable)
                  <textarea className="min-h-20 w-full rounded-lg border p-2 text-sm font-normal" placeholder="560002" value={zone.remotePinCodes.join(", ")} onChange={(event) => updateZone(index, { remotePinCodes: parseCodes(event.target.value) })} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <NumberField label="Zone base fee" value={zone.baseFee ?? null} nullable onChange={(value) => updateZone(index, { baseFee: value ?? undefined })} />
                <NumberField label="Zone / km" value={zone.distanceRatePerKm ?? null} nullable onChange={(value) => updateZone(index, { distanceRatePerKm: value ?? undefined })} />
                <NumberField label="Zone / kg" value={zone.weightRatePerKg ?? null} nullable onChange={(value) => updateZone(index, { weightRatePerKg: value ?? undefined })} />
                <NumberField label="Zone remote surcharge" value={zone.remoteSurcharge ?? null} nullable onChange={(value) => updateZone(index, { remoteSurcharge: value ?? undefined })} />
                <NumberField label="Zone route fallback fee" value={zone.fallbackFee ?? null} nullable onChange={(value) => updateZone(index, { fallbackFee: value })} />
                <NumberField label="Zone minimum fee" value={zone.minimumFee ?? null} nullable onChange={(value) => updateZone(index, { minimumFee: value ?? undefined })} />
                <NumberField label="Zone maximum fee" value={zone.maximumFee ?? null} nullable onChange={(value) => updateZone(index, { maximumFee: value })} />
                <NumberField label="Min delivery days" value={zone.estimatedMinDays ?? null} nullable onChange={(value) => updateZone(index, { estimatedMinDays: value ?? undefined })} />
                <NumberField label="Max delivery days" value={zone.estimatedMaxDays ?? null} nullable onChange={(value) => updateZone(index, { estimatedMaxDays: value ?? undefined })} />
              </div>
            </div>
          ))}
        </Card>

        <Card className="space-y-2 p-6">
          <h2 className="font-bold text-[#1a3321]">Courier partner readiness</h2>
          <p className="text-sm text-muted-foreground">
            Versioned configuration supports disabled courier rate-card records with pickup, delivery, other fees, and weight slabs. No partner or rate is assumed or used until an integration is explicitly enabled.
          </p>
        </Card>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="rounded-xl bg-[#1a3321] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "Saving version…" : "Save as new configuration version"}
        </button>
      </form>

      <Card className="overflow-x-auto p-6">
        <h2 className="mb-1 font-bold text-[#1a3321]">Estimated vs. actual courier cost</h2>
        <p className="mb-4 text-xs text-muted-foreground">Estimated shipping is the buyer quote. Actual courier charges are recorded separately and do not rewrite historical estimates.</p>
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead><tr className="border-b text-muted-foreground"><th className="p-2">Order</th><th className="p-2">Seller / PIN zone</th><th className="p-2">Estimate</th><th className="p-2">Actual cost</th><th className="p-2">Courier</th><th className="p-2"></th></tr></thead>
          <tbody>
            {snapshots.map((snapshot) => <ShippingReportRow key={snapshot.id} snapshot={snapshot} onSaved={refresh} />)}
            {snapshots.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>No shipment snapshots yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ShippingReportRow({
  snapshot,
  onSaved,
}: {
  snapshot: Awaited<ReturnType<typeof getAdminShippingReport>>[number];
  onSaved: () => void;
}) {
  const [actual, setActual] = useState(snapshot.actualCourierCost?.toString() || "");
  const [courier, setCourier] = useState(snapshot.courierName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <tr className="border-b">
      <td className="p-2">{snapshot.orderId}</td>
      <td className="p-2">{snapshot.seller.companyName}<br />{snapshot.shippingZone}: {snapshot.buyerPin}</td>
      <td className="p-2">₹{snapshot.order.shippingFee.toFixed(2)}</td>
      <td className="p-2"><Input type="number" min="0" step="0.01" value={actual} onChange={(event) => setActual(event.target.value)} className="h-8 w-28" /></td>
      <td className="p-2"><Input value={courier} onChange={(event) => setCourier(event.target.value)} placeholder="Courier name" className="h-8 w-36" /></td>
      <td className="p-2">
        <button disabled={saving} className="rounded border px-2 py-1 font-semibold disabled:opacity-50" onClick={async () => {
          setSaving(true);
          setError("");
          try {
            const result = await updateActualCourierCost(snapshot.id, actual === "" ? null : Number(actual), courier || null);
            if (result.success) onSaved();
            else setError(result.error || "Actual courier cost could not be saved.");
          } catch (saveError: unknown) {
            console.error("Could not save actual courier cost:", saveError);
            setError("Actual courier cost could not be saved.");
          } finally {
            setSaving(false);
          }
        }}>{saving ? "…" : "Save"}</button>
        {error && <p role="alert" className="mt-1 text-[10px] text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

const EMPTY_WAREHOUSE: WarehouseInput = {
  address: "",
  street: "",
  landmark: "",
  postalCode: "",
  city: "",
  state: "",
  country: "India",
  latitude: null,
  longitude: null,
  providerLocationId: null,
  geocodingProvider: null,
};

export function SellerWarehouseView() {
  const [warehouse, setWarehouse] = useState<WarehouseInput>(EMPTY_WAREHOUSE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSellerWarehouse().then((result) => {
      if (result.success && result.warehouse) {
        setWarehouse({
          address: result.warehouse.address,
          street: result.warehouse.street,
          landmark: result.warehouse.landmark,
          postalCode: result.warehouse.postalCode,
          city: result.warehouse.city,
          state: result.warehouse.state,
          country: result.warehouse.country,
          latitude: result.warehouse.latitude,
          longitude: result.warehouse.longitude,
          providerLocationId: result.warehouse.providerLocationId,
          geocodingProvider: result.warehouse.geocodingProvider,
        });
      } else if (!result.success) {
        setError(result.error);
      }
    }).catch((loadError: unknown) => {
      console.error("Could not load warehouse details:", loadError);
      setError("Warehouse details could not be loaded.");
    });
  }, []);

  const setLocation = (location: SelectedLocation) => {
    setWarehouse((current) => ({
      ...current,
      address: location.displayName || current.address,
      street: location.street || current.street,
      postalCode: location.postalCode || current.postalCode,
      city: location.city || current.city,
      state: location.state || current.state,
      country: location.country || current.country,
      latitude: location.latitude,
      longitude: location.longitude,
      providerLocationId: location.providerLocationId,
      geocodingProvider: location.provider,
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await saveSellerWarehouse(warehouse);
      if (!result.success) setError(result.error || "Warehouse could not be saved.");
    } catch (saveError: unknown) {
      console.error("Could not save warehouse location:", saveError);
      setError("Warehouse could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#2d4a36]">Registered Warehouse</h1>
        <p className="mt-1 text-sm text-muted-foreground">Maintain one active dispatch location. Business and warehouse addresses remain separate.</p>
      </div>
      <form onSubmit={save} className="space-y-4">
        <Card className="space-y-4 p-6">
          <LocationPicker latitude={warehouse.latitude} longitude={warehouse.longitude} onSelect={setLocation} />
          {(warehouse.latitude !== null || warehouse.longitude !== null) && (
            <button type="button" className="text-xs text-[#2d4a36] underline" onClick={() => setWarehouse((current) => ({
              ...current,
              latitude: null,
              longitude: null,
              geocodingProvider: null,
              providerLocationId: null,
            }))}>
              Save manually without map coordinates
            </button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["Full warehouse address", "address"],
              ["Street / building", "street"],
              ["Landmark", "landmark"],
              ["6-digit PIN code", "postalCode"],
              ["City", "city"],
              ["State", "state"],
              ["Country", "country"],
            ] as const).map(([label, key]) => (
              <label key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input value={warehouse[key] || ""} required={key !== "landmark"} maxLength={300} onChange={(event) => setWarehouse((current) => ({ ...current, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button disabled={saving} className="rounded-xl bg-[#2d4a36] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save warehouse location"}
          </button>
        </Card>
      </form>
    </div>
  );
}
