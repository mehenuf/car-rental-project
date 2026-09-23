import { expect, test, type Page } from "@playwright/test";
import { hasSampleData } from "./support";

// The booking panel on a vehicle page, from choosing a trip to the redirect to checkout. The quote and booking APIs
// are answered by the test (page.route), so nothing is priced against the database, no booking is created, and no
// real payment or notification can happen. The vehicle page itself needs the sample data, so the tests skip without it.

const VEHICLE = "/en/cars/honda-civic";
const FUTURE = "pickupDate=2030-03-10&dropoffDate=2030-03-12&pickupTime=10:00&dropoffTime=10:00";

const QUOTE = {
  quote: {
    currency: "BDT",
    days: 2,
    pickupAt: "2030-03-10T10:00:00.000Z",
    dropoffAt: "2030-03-12T10:00:00.000Z",
    lines: [
      { kind: "base", label: "Rental", quantity: 2, amountMinor: 660000 },
      { kind: "service_fee", label: "Service fee", amountMinor: 33000 },
    ],
    subtotalMinor: 660000,
    taxMinor: 0,
    serviceFeeMinor: 33000,
    totalMinor: 693000,
    depositMinor: 500000,
    commissionMinor: 0,
    providerPayoutMinor: 0,
    platformRevenueMinor: 0,
    cancellationTiers: [{ hoursBefore: 48, refundBp: 10000 }],
  },
  token: "test-quote-token",
  expires_at: "2030-03-10T10:15:00.000Z",
  available_extras: [],
};

async function acceptCookies(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
  ]);
}

/** Answers the two APIs the panel writes through, and records what the panel sent. */
async function mockBookingApis(page: Page) {
  const sent: { quote: unknown[]; booking: unknown[] } = { quote: [], booking: [] };
  await page.route("**/api/quote", async (route) => {
    sent.quote.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(QUOTE) });
  });
  await page.route("**/api/bookings", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    sent.booking.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ reference: "BC-TEST01", pickup_at: QUOTE.quote.pickupAt, dropoff_at: QUOTE.quote.dropoffAt, total_amount: 6930 }),
    });
  });
  return sent;
}

test.describe("booking panel", () => {
  test.beforeEach(async ({ page, baseURL, request }) => {
    test.skip(!(await hasSampleData(request)), "needs a database with the sample data");
    await acceptCookies(page, baseURL);
  });

  test("a trip that has already started says so and offers no price", async ({ page }) => {
    const sent = await mockBookingApis(page);
    const response = await page.goto(`${VEHICLE}?pickupDate=2020-01-01&dropoffDate=2020-01-02`);
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await expect(page.getByRole("alert").filter({ hasText: "pick-up time has already passed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Book Now" })).toBeDisabled();
    await expect(page.getByText("Total", { exact: true })).toHaveCount(0);
    expect(sent.quote).toHaveLength(0);
  });

  test("a drop-off before the pick-up says so", async ({ page }) => {
    await mockBookingApis(page);
    const response = await page.goto(`${VEHICLE}?pickupDate=2030-03-12&dropoffDate=2030-03-10`);
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await expect(page.getByRole("alert").filter({ hasText: "Drop-off must be after pick-up" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Book Now" })).toBeDisabled();
  });

  test("the price is shown in the quote's currency, announced, and unlocks Book Now", async ({ page }) => {
    const sent = await mockBookingApis(page);
    const response = await page.goto(`${VEHICLE}?${FUTURE}`);
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await expect(page.getByText("BDT 6,930.00").first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Total: BDT 6,930.00" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Book Now" })).toBeEnabled();
    expect(sent.quote.length).toBeGreaterThan(0);
    expect(JSON.stringify(sent.quote.at(-1))).toContain("2030-03-10");
  });

  test("an age that cannot be right is refused instead of being ignored", async ({ page }) => {
    const sent = await mockBookingApis(page);
    const response = await page.goto(`${VEHICLE}?${FUTURE}`);
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await expect(page.getByRole("button", { name: "Book Now" })).toBeEnabled();
    await page.getByLabel("Driver's age (optional)").fill("12");
    await expect(page.getByRole("alert").filter({ hasText: "Enter an age from 16 to 99." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Book Now" })).toBeDisabled();
    await page.getByLabel("Driver's age (optional)").fill("30");
    await expect(page.getByRole("button", { name: "Book Now" })).toBeEnabled();
    expect(JSON.stringify(sent.quote.at(-1))).toContain('"driver_age":30');
  });

  test("confirming sends the signed quote and moves on to checkout", async ({ page }) => {
    const sent = await mockBookingApis(page);
    const response = await page.goto(`${VEHICLE}?${FUTURE}`);
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await page.getByRole("button", { name: "Book Now" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete your booking" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Full name").fill("Test Renter");
    await dialog.getByLabel("Email").fill("renter@example.com");
    await dialog.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(page).toHaveURL(/\/en\/checkout\/BC-TEST01$/);
    expect(sent.booking).toHaveLength(1);
    const body = sent.booking[0] as Record<string, unknown>;
    expect(body.quote_token).toBe("test-quote-token");
    expect(body.customer_name).toBe("Test Renter");
    expect(body.email).toBe("renter@example.com");
    expect(body.source).toBe("web");
  });

  test("a blank name or an address without a domain gets a readable message and nothing is sent", async ({ page }) => {
    // The browser lets both through (spaces satisfy required, a@b is a valid address to it), so this is our own check.
    const sent = await mockBookingApis(page);
    const response = await page.goto(`${VEHICLE}?${FUTURE}`);
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await page.getByRole("button", { name: "Book Now" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete your booking" });
    await dialog.getByLabel("Full name").fill("   ");
    await dialog.getByLabel("Email").fill("a@b");
    await dialog.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Enter your full name." })).toBeVisible();
    await expect(dialog.getByRole("alert").filter({ hasText: "Enter a valid email address." })).toBeVisible();
    expect(sent.booking).toHaveLength(0);
    // Fixing both lets the booking through.
    await dialog.getByLabel("Full name").fill("Test Renter");
    await dialog.getByLabel("Email").fill("renter@example.com");
    await dialog.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(page).toHaveURL(/\/en\/checkout\/BC-TEST01$/);
  });

  test("a missing name or email in the dialog is caught before anything is sent", async ({ page }) => {
    const sent = await mockBookingApis(page);
    const response = await page.goto(`${VEHICLE}?${FUTURE}`);
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await page.getByRole("button", { name: "Book Now" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete your booking" });
    await dialog.getByLabel("Email").fill("not-an-email");
    await dialog.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(dialog).toBeVisible();
    expect(sent.booking).toHaveLength(0);
  });
});
