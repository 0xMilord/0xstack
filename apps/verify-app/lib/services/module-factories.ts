/**
 * Progressive activation entry points (PRD).
 * Use these instead of top-level imports from billing/storage/seo when modules may be disabled.
 */
export async function getBillingService() {
  try {
    await import("@/lib/billing/runtime");
    return await import("@/lib/services/billing.service");
  } catch {
    throw new Error(
      'Billing is not enabled. Set modules.billing to "dodo" or "stripe" in 0xstack.config.ts and run npx 0xstack baseline.'
    );
  }
}

export async function getStorageService() {
  try {
    await import("@/lib/storage/runtime");
    return await import("@/lib/services/storage.service");
  } catch {
    throw new Error(
      "Storage is not enabled. Set modules.storage in 0xstack.config.ts and run npx 0xstack baseline."
    );
  }
}

export async function getSeoConfig() {
  try {
    const m = await import("@/lib/seo/runtime");
    return m.getSeoRuntimeConfig();
  } catch {
    throw new Error("SEO is not enabled. Set modules.seo to true in 0xstack.config.ts and run npx 0xstack baseline.");
  }
}
