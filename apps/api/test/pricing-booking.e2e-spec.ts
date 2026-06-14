import * as request from "supertest";
import { getApp, closeApp, loginAs } from "./helpers";

describe("Pricing + Booking (e2e)", () => {
  let server: any;
  let customerToken: string;
  let adminToken: string;
  let listingId: string;

  // Use a future date range to avoid seed data conflicts
  const startAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
  const endAt = new Date(startAt.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

  beforeAll(async () => {
    const app = await getApp();
    server = app.getHttpServer();
    [customerToken, adminToken] = await Promise.all([
      loginAs(server, "customer@renting.ru", "Password1!"),
      loginAs(server, "admin@renting.ru", "Password1!"),
    ]);

    // Get first active listing
    const listingsRes = await request(server)
      .get("/api/v1/categories/cars/listings?perPage=1")
      .expect(200);
    listingId = listingsRes.body.data.items[0].id;
    expect(listingId).toBeDefined();
  });

  afterAll(closeApp);

  it("POST /listings/:id/quote — returns price breakdown", async () => {
    const res = await request(server)
      .post(`/api/v1/listings/${listingId}/quote`)
      .send({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        pricingUnit: "day",
        withDriver: false,
        currency: "USD",
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const q = res.body.data;
    expect(q.totalAmount).toBeGreaterThan(0);
    expect(q.breakdown.length).toBeGreaterThan(0);
    expect(q.currency).toBe("USD");
    expect(typeof q.taxAmount).toBe("number");
  });

  it("POST /listings/:id/quote — with WELCOME10 coupon applies discount", async () => {
    const withoutCoupon = await request(server)
      .post(`/api/v1/listings/${listingId}/quote`)
      .send({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), pricingUnit: "day", currency: "USD" });
    const withCoupon = await request(server)
      .post(`/api/v1/listings/${listingId}/quote`)
      .send({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        pricingUnit: "day",
        currency: "USD",
        couponCode: "WELCOME10",
      });
    expect(withCoupon.body.data.totalAmount).toBeLessThan(
      withoutCoupon.body.data.totalAmount,
    );
    expect(withCoupon.body.data.discountAmount).toBeGreaterThan(0);
  });

  let bookingId: string;

  it("POST /bookings — creates booking and returns code", async () => {
    const res = await request(server)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        listingId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        pricingUnit: "day",
        withDriver: false,
        currency: "USD",
        paymentMethod: "regional",
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    bookingId = res.body.data.id;
    expect(bookingId).toBeDefined();
    expect(res.body.data.code).toMatch(/^RNT-\d{4}-\d+$/);
    expect(res.body.data.status).toBe("pending");
  });

  it("POST /bookings — duplicate period returns 409 LISTING_UNAVAILABLE", async () => {
    const res = await request(server)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        listingId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        pricingUnit: "day",
        withDriver: false,
        currency: "USD",
        paymentMethod: "regional",
      })
      .expect(409);
    expect(res.body.error.code).toBe("LISTING_UNAVAILABLE");
  });

  it("PATCH /admin/bookings/:id/transition — confirm booking", async () => {
    const res = await request(server)
      .patch(`/api/v1/admin/bookings/${bookingId}/transition`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" })
      .expect(200);
    expect(res.body.data.status).toBe("confirmed");
  });

  it("PATCH /admin/bookings/:id/transition — invalid transition returns 400", async () => {
    const res = await request(server)
      .patch(`/api/v1/admin/bookings/${bookingId}/transition`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "pending" }) // can't go back
      .expect(400);
    expect(res.body.error.code).toBe("BOOKING_INVALID_TRANSITION");
  });

  it("GET /bookings — lists customer bookings", async () => {
    const res = await request(server)
      .get("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    const ids = res.body.data.items.map((b: any) => b.id);
    expect(ids).toContain(bookingId);
  });
});
