import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { EnvelopeInterceptor } from "../src/common/envelope.interceptor";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter";

let app: INestApplication;

export async function getApp(): Promise<INestApplication> {
  if (app) return app;
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

export async function closeApp() {
  if (app) await app.close();
}

export async function loginAs(
  server: any,
  email = "admin@renting.ru",
  password = "Password1!",
): Promise<string> {
  const res = await request(server)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);
  return res.body.data.accessToken as string;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
