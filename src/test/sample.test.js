const request = require("supertest");
const app = require("../../index");
const sequelize = require("../models/index");

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Environment setup", () => {
  it("should return health check", async () => {
    const res = await request(app).get("/api/");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
