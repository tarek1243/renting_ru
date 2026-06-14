import * as request from "supertest";
import { getApp, closeApp, loginAs } from "./helpers";

describe("Categories (e2e)", () => {
  let server: any;
  let adminToken: string;

  beforeAll(async () => {
    const app = await getApp();
    server = app.getHttpServer();
    adminToken = await loginAs(server, "admin@renting.ru", "Password1!");
  });

  afterAll(closeApp);

  it("GET /categories — lists enabled categories", async () => {
    const res = await request(server)
      .get("/api/v1/categories")
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const cars = res.body.data.find((c: any) => c.slug === "cars");
    expect(cars).toBeDefined();
    expect(cars.isEnabled).toBe(true);
    expect(cars.attributes.length).toBeGreaterThan(0);
  });

  it("GET /categories/cars — returns cars category with attributes", async () => {
    const res = await request(server)
      .get("/api/v1/categories/cars")
      .expect(200);
    expect(res.body.data.slug).toBe("cars");
    expect(res.body.data.pricingUnits.length).toBeGreaterThan(0);
  });

  it("Admin: toggle category off then on", async () => {
    // Get category id
    const listRes = await request(server)
      .get("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const cars = (listRes.body.data.items ?? listRes.body.data).find(
      (c: any) => c.slug === "cars",
    );
    expect(cars).toBeDefined();

    // Toggle off
    await request(server)
      .patch(`/api/v1/admin/categories/${cars.id}/toggle`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Category should now return CATEGORY_DISABLED
    const disabledRes = await request(server)
      .get("/api/v1/categories/cars")
      .expect(403);
    expect(disabledRes.body.error.code).toBe("CATEGORY_DISABLED");

    // Toggle back on
    await request(server)
      .patch(`/api/v1/admin/categories/${cars.id}/toggle`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Should work again
    await request(server).get("/api/v1/categories/cars").expect(200);
  });
});
