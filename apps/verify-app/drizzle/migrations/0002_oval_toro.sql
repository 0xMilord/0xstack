ALTER TABLE "assets" ADD COLUMN "provider" text NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_stripe_customer_id" ON "billing_customers" USING btree ("stripe_customer_id");