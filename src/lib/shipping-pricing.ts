export interface ShippingRate {
  baseFee: number;
  distanceRatePerKm: number;
  weightRatePerKg: number;
  handlingFee: number;
  remoteSurcharge: number;
  fallbackFee: number | null;
  minimumFee: number;
  maximumFee: number | null;
  weightSlabs: Array<{ minWeightKg: number; maxWeightKg: number | null; fee: number }>;
}

export interface ShippingRateZone {
  name: string;
  baseFee?: number;
  distanceRatePerKm?: number;
  weightRatePerKg?: number;
  handlingFee?: number;
  remoteSurcharge?: number;
  fallbackFee?: number | null;
  minimumFee?: number;
  maximumFee?: number | null;
}

export interface ShippingFeeBreakdown {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  handlingFee: number;
  remoteSurcharge: number;
  uncappedFee: number;
  minimumFee: number;
  maximumFee: number | null;
  totalFee: number;
  billableWeightKg: number;
  volumetricWeightKg: number;
}

export function calculateShippingFee(params: {
  config: ShippingRate;
  zone: ShippingRateZone;
  routeDistanceKm: number | null;
  actualWeightKg: number;
  volumetricWeightKg: number;
  remote: boolean;
}): {
  fee: number;
  breakdown: ShippingFeeBreakdown;
  estimateStatus: "ROUTE" | "FALLBACK_PIN_ZONE";
} {
  const { config, zone, routeDistanceKm, actualWeightKg, volumetricWeightKg, remote } = params;
  const baseFee = zone.baseFee ?? config.baseFee;
  const distanceRate = zone.distanceRatePerKm ?? config.distanceRatePerKm;
  const weightRate = zone.weightRatePerKg ?? config.weightRatePerKg;
  const handlingFee = zone.handlingFee ?? config.handlingFee;
  const remoteSurcharge = zone.remoteSurcharge ?? config.remoteSurcharge;
  const minimumFee = zone.minimumFee ?? config.minimumFee;
  const maximumFee = zone.maximumFee ?? config.maximumFee;
  const billableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);
  const weightSlab = config.weightSlabs.find((slab) =>
    billableWeightKg >= slab.minWeightKg &&
    (slab.maxWeightKg === null || billableWeightKg < slab.maxWeightKg)
  );
  if (config.weightSlabs.length > 0 && !weightSlab) {
    throw new Error("No configured weight slab covers this shipment.");
  }
  const weightFee = money(weightSlab ? weightSlab.fee : weightRate * billableWeightKg);
  const appliedRemoteSurcharge = remote ? remoteSurcharge : 0;
  const fallbackFee = zone.fallbackFee ?? config.fallbackFee;
  let distanceFee = 0;
  let uncappedFee: number;
  let estimateStatus: "ROUTE" | "FALLBACK_PIN_ZONE";

  if (routeDistanceKm === null) {
    if (fallbackFee === null) {
      throw new Error(`Road routing is unavailable for zone ${zone.name}, and no PIN-zone fallback fee is configured.`);
    }
    uncappedFee = fallbackFee + weightFee + handlingFee + appliedRemoteSurcharge;
    estimateStatus = "FALLBACK_PIN_ZONE";
  } else {
    distanceFee = money(routeDistanceKm * distanceRate);
    uncappedFee = baseFee + distanceFee + weightFee + handlingFee + appliedRemoteSurcharge;
    estimateStatus = "ROUTE";
  }

  const boundedFee = Math.max(minimumFee, maximumFee === null ? uncappedFee : Math.min(uncappedFee, maximumFee));
  const fee = money(boundedFee);
  return {
    fee,
    estimateStatus,
    breakdown: {
      baseFee: routeDistanceKm === null ? 0 : money(baseFee),
      distanceFee,
      weightFee,
      handlingFee: money(handlingFee),
      remoteSurcharge: money(appliedRemoteSurcharge),
      uncappedFee: money(uncappedFee),
      minimumFee: money(minimumFee),
      maximumFee: maximumFee === null ? null : money(maximumFee),
      totalFee: fee,
      billableWeightKg: Math.round(billableWeightKg * 1000) / 1000,
      volumetricWeightKg: Math.round(volumetricWeightKg * 1000) / 1000,
    },
  };
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
