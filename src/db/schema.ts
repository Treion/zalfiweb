/**
 * The database schema, in three parts:
 *  - catalogue: fragrances, notes, sizes (variants), product images
 *  - commerce:  stock ledger and reservations, customers, OTPs, orders, payments, refunds, returns,
 *               shipments, coupons, provider callbacks
 *  - admin:     admin users and sessions (Better Auth), invitations, settings, audit log, rate limits
 * Every change is a Drizzle migration (`npm run db:generate`, then `npm run db:migrate`).
 */
export * from "./tables/catalogue";
export * from "./tables/commerce";
export * from "./tables/admin";
