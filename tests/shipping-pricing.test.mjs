import assert from "node:assert/strict";
import test from "node:test";
import { calculateShippingFee } from "../src/lib/shipping-pricing.ts";

const config = {
  baseFee: 20,
  distanceRatePerKm: 2,
  weightRatePerKg: 10,
  handlingFee: 5,
  remoteSurcharge: 7,
  fallbackFee: null,
  minimumFee: 0,
  maximumFee: null,
  weightSlabs: [],
};
const zone = { name: "Central", pinCodes: ["560001"], remotePinCodes: [] };

test("calculates road, weight, handling, and remote charges separately", () => {
  const result = calculateShippingFee({
    config,
    zone,
    routeDistanceKm: 10,
    actualWeightKg: 2,
    volumetricWeightKg: 1,
    remote: true,
  });

  assert.equal(result.fee, 72);
  assert.equal(result.estimateStatus, "ROUTE");
  assert.deepEqual(result.breakdown, {
    baseFee: 20,
    distanceFee: 20,
    weightFee: 20,
    handlingFee: 5,
    remoteSurcharge: 7,
    uncappedFee: 72,
    minimumFee: 0,
    maximumFee: null,
    totalFee: 72,
    billableWeightKg: 2,
    volumetricWeightKg: 1,
  });
});

test("uses a configured PIN-zone fallback when routing is unavailable", () => {
  const result = calculateShippingFee({
    config: { ...config, fallbackFee: 30 },
    zone,
    routeDistanceKm: null,
    actualWeightKg: 2,
    volumetricWeightKg: 3,
    remote: false,
  });

  assert.equal(result.fee, 65);
  assert.equal(result.estimateStatus, "FALLBACK_PIN_ZONE");
  assert.equal(result.breakdown.baseFee, 0);
  assert.equal(result.breakdown.distanceFee, 0);
});

test("blocks a route failure without a configured fallback", () => {
  assert.throws(
    () => calculateShippingFee({
      config,
      zone,
      routeDistanceKm: null,
      actualWeightKg: 1,
      volumetricWeightKg: 0,
      remote: false,
    }),
    /no PIN-zone fallback fee is configured/
  );
});

test("uses volumetric weight slabs and applies fee limits", () => {
  const result = calculateShippingFee({
    config: {
      ...config,
      weightSlabs: [
        { minWeightKg: 0, maxWeightKg: 5, fee: 12 },
        { minWeightKg: 5, maxWeightKg: null, fee: 25 },
      ],
      minimumFee: 40,
      maximumFee: 50,
    },
    zone,
    routeDistanceKm: 100,
    actualWeightKg: 2,
    volumetricWeightKg: 6,
    remote: false,
  });

  assert.equal(result.breakdown.billableWeightKg, 6);
  assert.equal(result.breakdown.weightFee, 25);
  assert.equal(result.fee, 50);
  assert.equal(result.breakdown.maximumFee, 50);
});
