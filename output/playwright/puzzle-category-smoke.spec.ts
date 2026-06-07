import { test, expect } from "@playwright/test";

const themes = [
  { id: "mateIn2", label: "Mate In2" },
  { id: "mateIn3", label: "Mate In3" },
  { id: "mateIn4", label: "Mate In4" },
];

for (const theme of themes) {
  test(`loads ${theme.id} puzzle page with matching theme`, async ({ page }) => {
    const apiResponses: Array<{ url: string; status: number; body: unknown }> = [];

    page.on("response", async (response) => {
      if (!response.url().includes("/api/puzzles?")) {
        return;
      }

      try {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          body: await response.json(),
        });
      } catch {
        apiResponses.push({ url: response.url(), status: response.status(), body: null });
      }
    });

    await page.goto(`http://localhost:3000/puzzles/solve?mode=standard&theme=${theme.id}`);
    await expect(page.getByText("Puzzle Training")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(theme.label).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Could not load puzzle")).toHaveCount(0);
    await expect(page.getByText("Loading puzzle")).toHaveCount(0);

    const matchingResponse = apiResponses.find((entry) => entry.url.includes(`theme=${theme.id}`));
    expect(matchingResponse?.status).toBe(200);
    const puzzles = (matchingResponse?.body as { puzzles?: Array<{ themes?: string[] }> } | null)?.puzzles ?? [];
    expect(puzzles.length).toBeGreaterThan(0);
    expect(puzzles[0]?.themes).toContain(theme.id);
  });
}
