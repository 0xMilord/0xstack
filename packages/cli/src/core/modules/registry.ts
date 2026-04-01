import type { Module, ModuleContext } from "./types";
import { seoModule } from "./seo.module";
import { blogMdxModule } from "./blog.module";
import { billingDodoModule } from "./billing-dodo.module";
import { billingStripeModule } from "./billing-stripe.module";
import { storageGcsModule } from "./storage-gcs.module";
import { storageS3Module } from "./storage-s3.module";
import { storageSupabaseModule } from "./storage-supabase.module";
import { observabilityModule } from "./observability.module";
import { jobsModule } from "./jobs.module";
import { securityApiModule } from "./security-api.module";
import { webhookLedgerModule } from "./webhook-ledger";
import { uiFoundationModule } from "./ui-foundation.module";
import { coreDbStateModule } from "./core-db-state.module";
import { emailResendModule } from "./email-resend.module";
import { pwaModule } from "./pwa.module";
import { cacheModule } from "./cache.module";
import { authCoreModule } from "./auth-core.module";

export function getModules(): Module[] {
  return [
    cacheModule,
    authCoreModule,
    coreDbStateModule,
    uiFoundationModule,
    securityApiModule,
    webhookLedgerModule,
    observabilityModule,
    jobsModule,
    seoModule,
    blogMdxModule,
    billingDodoModule,
    billingStripeModule,
    storageGcsModule,
    storageS3Module,
    storageSupabaseModule,
    emailResendModule,
    pwaModule,
  ];
}

export async function runModulesLifecycle(ctx: ModuleContext) {
  for (const mod of getModules()) {
    await mod.install(ctx);
    await mod.activate(ctx);
    await mod.validate(ctx);
    await mod.sync(ctx);
  }
}

