import * as request from "supertest";
import { getApp, closeApp } from "./helpers";

describe("Auth (e2e)", () => {
  let server: any;

  beforeAll(async () => {
    const app = await getApp();
    server = app.getHttpServer();
  });

  afterAll(closeApp);

  it("POST /auth/register — creates account", async () => {
    const email = `e2e-${Date.now()}@test.com`;
    const res = await request(server)
      .post("/api/v1/auth/register")
      .send({ name: "E2E User", email, password: "Password1!" })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
  });

  it("POST /auth/login — returns tokens", async () => {
    const res = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@renting.ru", password: "Password1!" })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe("admin@renting.ru");
  });

  it("POST /auth/login — wrong password returns 401", async () => {
    const res = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@renting.ru", password: "WrongPass!" })
      .expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /auth/me — returns current user", async () => {
    const loginRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@renting.ru", password: "Password1!" });
    const token = loginRes.body.data.accessToken;

    const res = await request(server)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.email).toBe("admin@renting.ru");
  });

  it("POST /auth/refresh — returns new access token", async () => {
    const loginRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "customer@renting.ru", password: "Password1!" });
    const { refreshToken } = loginRes.body.data;

    const res = await request(server)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
});
