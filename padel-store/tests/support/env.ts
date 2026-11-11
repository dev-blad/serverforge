// Integration tests run against a separate database (never the dev DB).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://padel:padel@localhost:5432/padel_test";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_for_vitest";
process.env.AUTH_SECRET ??= "test-secret";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.PRINTNODE_API_KEY;
process.env.SHIPPING_PROVIDER = "stub";
