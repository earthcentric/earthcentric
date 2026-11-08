import "server-only";

import db from "@/lib/db";
import { getRoadRoute } from "@/lib/location-services";
import { calculateBuyXGetYFreeItems } from "@/lib/offers";
import { calculateCheckoutLine } from "@/lib/checkout-pricing";
import { calculateShippingFee, type ShippingFeeBreakdown } from "@/lib/shipping-pricing";

export interface WeightSlab {
  minWeightKg: number;
  maxWeightKg: number | null;
  fee: number;
}

export interface ShippingZone {
  name: string;
  pinCodes: string[];
  remotePinCodes: string[];
  baseFee?: number;
  distanceRatePerKm?: number;
  weightRatePerKg?: number;
  handlingFee?: number;
  remoteSurcharge?: number;
  fallbackFee?: number | null;
  minimumFee?: number;
  maximumFee?: number | null;
  estimatedMinDays?: number;
  estimatedMaxDays?: number;
}

export interface ShippingConfig {
  enabled: boolean;
  baseFee: number;
  distanceRatePerKm: number;
  weightRatePerKg: number;
  handlingFee: number;
  remoteSurcharge: number;
  fallbackFee: number | null;
  minimumFee: number;
  maximumFee: number | null;
  volumetricDivisor: number | null;
  weightSlabs: WeightSlab[];
  estimatedMinDays: number;
  estimatedMaxDays: number;
  zones: ShippingZone[];
  courierRateCards: Array<{
    courierName: string;
    enabled: boolean;
    pickupFee: number;
    deliveryFee: number;
    otherFee: number;
    weightSlabs: WeightSlab[];
  }>;
}

export interface ShipmentQuote {
  sellerId: string;
  sellerName: string;
  fee: number;
  zone: string;
  routeDistanceKm: number | null;
  routeDurationMinutes: number | null;
  routeProvider: string | null;
  estimateStatus: "ROUTE" | "FALLBACK_PIN_ZONE";
  estimatedMinDays: number;
  estimatedMaxDays: number;
  breakdown: ShippingFeeBreakdown;
  warehouse: {
    address: string;
    street: string;
    postalCode: string;
    city: string;
    state: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface ShippingQuoteResult {
  configurationVersion: number;
  shipments: ShipmentQuote[];
  totalFee: number;
  merchandiseSubtotal: number;
  items: Array<{
    productId: string;
    name: string;
    sellerId: string;
    quantity: number;
    unitPrice: number;
    productSellingPrice: number;
    sellerBaseAmount: number;
    commissionAmount: number;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNonNegativeNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Shipping configuration field ${field} must be a non-negative number.`);
  }
  return value;
}

function parseWeightSlabs(value: unknown, field: string): WeightSlab[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be a list of weight slabs.`);
  const slabs = value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${field} entry ${index + 1} is invalid.`);
    const minWeightKg = optionalNonNegativeNumber(entry.minWeightKg, `${field}.minWeightKg`);
    const fee = optionalNonNegativeNumber(entry.fee, `${field}.fee`);
    const maxWeightKg = nullableOptional(entry.maxWeightKg, `${field}.maxWeightKg`) ?? null;
    if (minWeightKg === undefined || fee === undefined ||
        (maxWeightKg !== null && maxWeightKg <= minWeightKg)) {
      throw new Error(`${field} entry ${index + 1} needs a valid weight range and fee.`);
    }
    return { minWeightKg, maxWeightKg, fee };
  });
  slabs.sort((a, b) => a.minWeightKg - b.minWeightKg);
  if (slabs.length > 0 && (slabs[0].minWeightKg !== 0 || slabs[slabs.length - 1].maxWeightKg !== null ||
      slabs.some((slab, index) => index > 0 && slabs[index - 1].maxWeightKg !== slab.minWeightKg))) {
    throw new Error(`${field} must cover all billable weights continuously, starting at 0 and ending with no maximum.`);
  }
  return slabs;
}

export function parseShippingConfig(value: unknown): ShippingConfig {
  if (!isRecord(value)) throw new Error("Shipping configuration is invalid.");
  const required = (key: string) => {
    const number = value[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < 0) {
      throw new Error(`Shipping configuration field ${key} must be a non-negative number.`);
    }
    return number;
  };
  const nullable = (key: string) => {
    const candidate = value[key];
    if (candidate === null || candidate === undefined || candidate === "") return null;
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) {
      throw new Error(`Shipping configuration field ${key} must be empty or a non-negative number.`);
    }
    return candidate;
  };

  if (typeof value.enabled !== "boolean" || !Array.isArray(value.zones)) {
    throw new Error("Shipping configuration must include enabled and zones settings.");
  }

  const zones: ShippingZone[] = value.zones.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.name !== "string" || !entry.name.trim()) {
      throw new Error(`Shipping zone ${index + 1} needs a name.`);
    }
    if (!Array.isArray(entry.pinCodes) || !Array.isArray(entry.remotePinCodes)) {
      throw new Error(`Shipping zone ${entry.name} needs PIN-code lists.`);
    }
    const pinCodes = entry.pinCodes.map(String);
    const remotePinCodes = entry.remotePinCodes.map(String);
    if (pinCodes.some((pin) => !/^\d{6}$/.test(pin)) ||
        remotePinCodes.some((pin) => !pinCodes.includes(pin))) {
      throw new Error(`Shipping zone ${entry.name} contains an invalid or unassigned remote PIN code.`);
    }
    return {
      name: entry.name.trim(),
      pinCodes: [...new Set(pinCodes)],
      remotePinCodes: [...new Set(remotePinCodes)],
      ...(optionalNonNegativeNumber(entry.baseFee, "zone.baseFee") !== undefined ? { baseFee: entry.baseFee as number } : {}),
      ...(optionalNonNegativeNumber(entry.distanceRatePerKm, "zone.distanceRatePerKm") !== undefined ? { distanceRatePerKm: entry.distanceRatePerKm as number } : {}),
      ...(optionalNonNegativeNumber(entry.weightRatePerKg, "zone.weightRatePerKg") !== undefined ? { weightRatePerKg: entry.weightRatePerKg as number } : {}),
      ...(optionalNonNegativeNumber(entry.handlingFee, "zone.handlingFee") !== undefined ? { handlingFee: entry.handlingFee as number } : {}),
      ...(optionalNonNegativeNumber(entry.remoteSurcharge, "zone.remoteSurcharge") !== undefined ? { remoteSurcharge: entry.remoteSurcharge as number } : {}),
      ...(nullableOptional(entry.fallbackFee, "zone.fallbackFee") !== undefined ? { fallbackFee: nullableOptional(entry.fallbackFee, "zone.fallbackFee") } : {}),
      ...(optionalNonNegativeNumber(entry.minimumFee, "zone.minimumFee") !== undefined ? { minimumFee: entry.minimumFee as number } : {}),
      ...(nullableOptional(entry.maximumFee, "zone.maximumFee") !== undefined ? { maximumFee: nullableOptional(entry.maximumFee, "zone.maximumFee") } : {}),
      ...(optionalNonNegativeNumber(entry.estimatedMinDays, "zone.estimatedMinDays") !== undefined ? { estimatedMinDays: entry.estimatedMinDays as number } : {}),
      ...(optionalNonNegativeNumber(entry.estimatedMaxDays, "zone.estimatedMaxDays") !== undefined ? { estimatedMaxDays: entry.estimatedMaxDays as number } : {}),
    };
  });
  const volumetricDivisor = nullable("volumetricDivisor");
  const maximumFee = nullable("maximumFee");
  const fallbackFee = nullable("fallbackFee");
  const estimatedMinDays = required("estimatedMinDays");
  const estimatedMaxDays = required("estimatedMaxDays");
  const minimumFee = required("minimumFee");
  if (!Number.isInteger(estimatedMinDays) || !Number.isInteger(estimatedMaxDays) || estimatedMaxDays < estimatedMinDays) {
    throw new Error("Estimated delivery days must be whole numbers and the maximum must not be less than the minimum.");
  }
  if (maximumFee !== null && maximumFee < minimumFee) {
    throw new Error("Maximum delivery fee must not be less than the minimum delivery fee.");
  }
  for (const zone of zones) {
    const zoneMinimumFee = zone.minimumFee ?? minimumFee;
    const zoneMaximumFee = zone.maximumFee ?? maximumFee;
    if (zoneMaximumFee !== null && zoneMaximumFee < zoneMinimumFee) {
      throw new Error(`Maximum delivery fee for ${zone.name} must not be less than its minimum delivery fee.`);
    }
    const zoneMinDays = zone.estimatedMinDays ?? estimatedMinDays;
    const zoneMaxDays = zone.estimatedMaxDays ?? estimatedMaxDays;
    if (!Number.isInteger(zoneMinDays) || !Number.isInteger(zoneMaxDays) || zoneMaxDays < zoneMinDays) {
      throw new Error(`Estimated delivery days for ${zone.name} must be whole numbers with a valid range.`);
    }
  }
  if (volumetricDivisor !== null && volumetricDivisor <= 0) {
    throw new Error("Volumetric divisor must be greater than zero.");
  }
  const pinCodes = zones.flatMap((zone) => zone.pinCodes);
  if (new Set(pinCodes).size !== pinCodes.length) {
    throw new Error("A serviceable PIN code can belong to only one shipping zone.");
  }
  if (value.courierRateCards !== undefined && !Array.isArray(value.courierRateCards)) {
    throw new Error("Courier rate cards must be a list.");
  }
  const courierRateCards = (Array.isArray(value.courierRateCards) ? value.courierRateCards : []).map((entry, index) => {
    if (!isRecord(entry) || typeof entry.courierName !== "string" ||
        !entry.courierName.trim() || typeof entry.enabled !== "boolean") {
      throw new Error(`Courier rate card ${index + 1} is invalid.`);
    }
    return {
      courierName: entry.courierName.trim(),
      enabled: entry.enabled,
      pickupFee: optionalNonNegativeNumber(entry.pickupFee, "courier.pickupFee") ?? 0,
      deliveryFee: optionalNonNegativeNumber(entry.deliveryFee, "courier.deliveryFee") ?? 0,
      otherFee: optionalNonNegativeNumber(entry.otherFee, "courier.otherFee") ?? 0,
      weightSlabs: parseWeightSlabs(entry.weightSlabs, `courier ${entry.courierName} weightSlabs`),
    };
  });

  return {
    enabled: value.enabled,
    baseFee: required("baseFee"),
    distanceRatePerKm: required("distanceRatePerKm"),
    weightRatePerKg: required("weightRatePerKg"),
    handlingFee: required("handlingFee"),
    remoteSurcharge: required("remoteSurcharge"),
    fallbackFee,
    minimumFee,
    maximumFee,
    volumetricDivisor,
    weightSlabs: parseWeightSlabs(value.weightSlabs, "weightSlabs"),
    estimatedMinDays,
    estimatedMaxDays,
    zones,
    courierRateCards,
  };
}

function nullableOptional(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return optionalNonNegativeNumber(value, field) ?? null;
}

export async function getActiveShippingConfiguration(): Promise<{
  version: number;
  config: ShippingConfig;
} | null> {
  const active = await db.shippingConfiguration.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
  });
  if (!active) return null;
  const config = parseShippingConfig(active.config);
  if (!active.enabled || !config.enabled) return null;
  return { version: active.version, config };
}

export async function quoteSellerShipments(
  addressId: string,
  userId: string,
  cartItems: Array<{ productId: string; quantity: number }>
): Promise<ShippingQuoteResult> {
  if (!Array.isArray(cartItems) || cartItems.length === 0 || cartItems.length > 100) {
    throw new Error("The cart does not contain a valid set of items.");
  }
  const normalizedItems = new Map<string, number>();
  for (const item of cartItems) {
    if (!item || typeof item.productId !== "string" || !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 10000) {
      throw new Error("The cart contains an invalid product quantity.");
    }
    normalizedItems.set(item.productId, (normalizedItems.get(item.productId) || 0) + item.quantity);
  }

  const [shipping, address] = await Promise.all([
    getActiveShippingConfiguration(),
    db.address.findFirst({
      where: { id: addressId, userId, NOT: { street: { startsWith: "[Deleted]" } } },
    }),
  ]);
  if (!shipping) throw new Error("Shipping is not configured. Please contact support before checking out.");
  if (!address) throw new Error("Select a saved delivery address belonging to your account.");
  if (!/^\d{6}$/.test(address.postalCode)) throw new Error("The delivery address needs a valid 6-digit PIN code.");

  const products = await db.product.findMany({
    where: { id: { in: [...normalizedItems.keys()] }, isApproved: true, status: "APPROVED" },
    include: { seller: { include: { warehouse: true } } },
  });
  if (products.length !== normalizedItems.size) {
    throw new Error("A product is no longer available for delivery.");
  }

  const bySeller = new Map<string, typeof products>();
  for (const product of products) {
    const sellerProducts = bySeller.get(product.sellerId) || [];
    sellerProducts.push(product);
    bySeller.set(product.sellerId, sellerProducts);
  }

  const shipments: ShipmentQuote[] = [];
  const quoteItems = products.map((product) => {
    const quantity = normalizedItems.get(product.id) || 0;
    const line = calculateCheckoutLine(product, quantity);
    return {
      productId: product.id,
      name: product.name,
      sellerId: product.sellerId,
      quantity,
      unitPrice: line.unitPrice,
      productSellingPrice: line.itemTotal,
      sellerBaseAmount: line.sellerBaseAmount,
      commissionAmount: line.commissionAmount,
    };
  });
  for (const [sellerId, sellerProducts] of bySeller) {
    const seller = sellerProducts[0].seller;
    const warehouse = seller.warehouse;
    if (!warehouse || !warehouse.isActive) {
      throw new Error(`Seller ${seller.companyName} has not registered an active warehouse.`);
    }
    if (!/^\d{6}$/.test(warehouse.postalCode)) {
      throw new Error(`Seller ${seller.companyName} needs to complete its warehouse PIN code.`);
    }

    const zone = shipping.config.zones.find((candidate) => candidate.pinCodes.includes(address.postalCode));
    if (!zone) throw new Error(`PIN code ${address.postalCode} is not currently serviceable.`);

    let actualWeightKg = 0;
    let volumetricWeightKg = 0;
    for (const product of sellerProducts) {
      const purchasedQuantity = normalizedItems.get(product.id) || 0;
      const quantity = purchasedQuantity + calculateBuyXGetYFreeItems(
        purchasedQuantity,
        product.buyXGetYOffer
      );
      if (product.weightKg === null || product.weightKg <= 0) {
        throw new Error(`Shipping weight is not available for "${product.name}". Please contact the seller.`);
      }
      actualWeightKg += product.weightKg * quantity;
      if (shipping.config.volumetricDivisor) {
        if (!product.lengthCm || !product.widthCm || !product.heightCm) {
          throw new Error(`Package dimensions are required for "${product.name}" by the active volumetric shipping rules.`);
        }
        volumetricWeightKg += (product.lengthCm * product.widthCm * product.heightCm / shipping.config.volumetricDivisor) * quantity;
      }
    }

    let routeDistanceKm: number | null = null;
    let routeDurationMinutes: number | null = null;
    let routeProvider: string | null = null;
    if (
      warehouse.latitude !== null && warehouse.latitude !== undefined &&
      warehouse.longitude !== null && warehouse.longitude !== undefined &&
      address.latitude !== null && address.latitude !== undefined &&
      address.longitude !== null && address.longitude !== undefined
    ) {
      try {
        const route = await getRoadRoute(
          { latitude: warehouse.latitude, longitude: warehouse.longitude },
          { latitude: address.latitude, longitude: address.longitude }
        );
        if (route) {
          routeDistanceKm = route.distanceKm;
          routeDurationMinutes = route.durationMinutes;
          routeProvider = route.provider;
        }
      } catch (error) {
        console.warn("Road route unavailable; configured PIN-zone fallback will be considered.", error);
      }
    }

    const remote = zone.remotePinCodes.includes(address.postalCode);
    const feeResult = calculateShippingFee({
      config: shipping.config,
      zone,
      routeDistanceKm,
      actualWeightKg,
      volumetricWeightKg,
      remote,
    });

    shipments.push({
      sellerId,
      sellerName: seller.companyName,
      fee: feeResult.fee,
      zone: zone.name,
      routeDistanceKm,
      routeDurationMinutes,
      routeProvider,
      estimateStatus: feeResult.estimateStatus,
      estimatedMinDays: zone.estimatedMinDays ?? shipping.config.estimatedMinDays,
      estimatedMaxDays: zone.estimatedMaxDays ?? shipping.config.estimatedMaxDays,
      breakdown: feeResult.breakdown,
      warehouse: {
        address: warehouse.address,
        street: warehouse.street,
        postalCode: warehouse.postalCode,
        city: warehouse.city,
        state: warehouse.state,
        country: warehouse.country,
        latitude: warehouse.latitude,
        longitude: warehouse.longitude,
      },
    });
  }

  return {
    configurationVersion: shipping.version,
    shipments,
    totalFee: money(shipments.reduce((total, shipment) => total + shipment.fee, 0)),
    merchandiseSubtotal: money(quoteItems.reduce((total, item) => total + item.productSellingPrice, 0)),
    items: quoteItems,
  };
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
