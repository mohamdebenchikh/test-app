const request = require("supertest");
const app = require("../../index");

describe("Internationalization (i18n)", () => {
  it("should return a translated error message for a non-existent route using the lang query parameter", async () => {
    const res = await request(app).get("/api/non-existent-route?lang=fr");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Route non trouvée");
  });

  it("should return a translated error message for a non-existent route using the Accept-Language header", async () => {
    const res = await request(app)
      .get("/api/non-existent-route")
      .set("Accept-Language", "ar");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("المسار غير موجود");
  });

  it("should return the default English error message when no language preference is provided", async () => {
    const res = await request(app).get("/api/non-existent-route");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Route not found");
  });
});
