# CarryBee Delivery API: what the site uses

From the API doc the owner supplied (CarryBee's docs aren't public). The code is `src/server/shipping/carrybee.ts` and `status-carrybee.ts`.

## Connection

| | Base URL |
|---|---|
| Production | `https://developers.carrybee.com` |
| Sandbox | `https://sandbox.carrybee.com` |

Every request sends `Client-ID`, `Client-Secret` and `Client-Context` (from the **API Credentials** page, per business and per environment) and `Content-Type: application/json`.

Errors are `{ "error": true, "message": "…" }`. A validation error (422) adds `causes`: `{ "field": [{ "type": "…", "attribute": {} }] }`.

Units: `item_weight` in grams (1–25,000), `item_quantity` 1–200, `collectable_amount` in whole taka (0–100,000). `delivery_type` 1 = Normal, 2 = Express. `product_type` 1 = Parcel, 2 = Book, 3 = Document.

## Endpoints used

| What | Call | Answer |
|---|---|---|
| Cities | `GET /api/v2/cities` | `data.cities [{ id, name }]` |
| Zones | `GET /api/v2/cities/{city_id}/zones` | `data.zones [{ id, name, city_id }]` |
| Address → city and zone | `POST /api/v2/address-details` `{ query }` (10+ characters) | `data { city_id, zone_id }` |
| Pickup stores | `GET /api/v2/stores` | `data.stores [{ id (string), name, address, is_active, is_approved, … }]` |
| Create a parcel | `POST /api/v2/orders` | 201, `data.order { consignment_id, delivery_fee, cod_fee, … }` |
| Status | `GET /api/v2/orders/{consignment_id}/details` | `data.transfer_status`, `attempt`, `reason`, … |
| Cancel | `POST /api/v2/orders/{consignment_id}/cancel` `{ cancellation_reason }` (under 200) | 202, `error: false` |

The parcel body: `store_id`, `merchant_order_id` (under 50), `delivery_type: 1`, `product_type: 1`, `recipient_phone`, `recipient_name` (2–99), `recipient_address` (10–200), `city_id`, `zone_id`, `special_instruction` and `product_description` (under 255), `item_weight`, `item_quantity`, `collectable_amount`, `is_closed_box: true`.

Not used yet: `area-suggestion`, areas, store creation, bulk orders, reverse pickup and exchange.

## Webhooks

Set on CarryBee's **Webhook Integration** page. CarryBee posts every status change, with the secret in `X-CB-Webhook-Integration-Header`. The endpoint must answer **202** and echo that header with the exact secret, within the timeout, over valid HTTPS, in at most 3 redirects.

Each event has `event`, `store_id`, `consignment_id`, `merchant_order_id`, `timestamptz`, and some add `attempt`, `reason`, `remarks`, `collected_amount`. Events: `order.created`, `order.create-failed` (bulk only, no consignment), `order.updated`, `order.pickup-requested`, `order.assigned-for-pickup`, `order.picked`, `order.pickup-failed`, `order.pickup-cancelled`, `order.at-the-sorting-hub`, `order.on-the-way-to-central-warehouse`, `order.at-central-warehouse`, `order.in-transit`, `order.received-at-last-mile-hub`, `order.assigned-for-delivery`, `order.delivery-on-hold`, `order.delivered`, `order.partial-delivery`, `order.delivery-failed`, `order.returned`, `order.paid-return`, `order.exchange`, `order.paid`, `order.returned-at-sorting`, `order.returned-in-transit`, `order.returned-to-merchant`.

How each maps to the order is in `status-carrybee.ts`.
