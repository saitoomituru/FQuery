import { expect, test } from "@playwright/test";

const source = "雨が降っている。傘を持って出かける。ただし降水量は未確認である。";

test("fixture分解をGUIから実行し、通信・FAM・投影の境界を観測できる", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("main", { name: "node editor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /FQuery Playground/ })).toBeVisible();
  await expect(page.locator('[data-runtime-error="true"]')).toHaveCount(0);

  const toolPaneToggle = page.getByRole("button", { name: "toggle tool pane (T)" });
  await toolPaneToggle.click();
  await expect(toolPaneToggle).toHaveAttribute("aria-pressed", "false");

  const route = page.locator(".psi-node").first();
  await route.getByLabel("decomposer").selectOption("fixture");
  await route.getByLabel("source").fill(source);

  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/api/decompose",
  );
  await route.getByRole("button", { name: "分解を実行" }).click();

  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({
    provider: "fixture",
    model: "mock-fam-transformer",
    source,
  });

  const body = await response.json() as {
    result?: Record<string, unknown>;
    ref_fam_receipt?: Record<string, unknown>;
  };
  expect(body.result).toMatchObject({
    transport_status: "succeeded",
    plugin_status: "resolved",
    semantic_status: "not-evaluated",
    lambda_status: "not-evaluated",
    control_status: "result",
  });
  expect(body.ref_fam_receipt).toMatchObject({
    profile_ref: "fam://fquery/test/basic-commons-access-mapper/generic-open-world",
    revision_ref: "rev://fquery/test/basic-commons-access-mapper/generic-open-world/1",
    resolved_before_provider: true,
  });

  await expect(route.locator('[data-axis="transport"]')).toContainText("succeeded");
  await expect(route.locator('[data-axis="plugin"]')).toContainText("resolved");
  await expect(page.locator(".fold-unit-node")).toHaveCount(3);
  await expect(page.locator(".lambda-node")).toContainText("雨が降っている。");
  await expect(page.locator(".lambda-node")).toContainText("傘を持って出かける。");
  await expect(page.locator(".lambda-node")).toContainText("ただし降水量は未確認である。");
  await expect(page.locator(".lambda-node").locator('[data-axis="lambda"]')).toContainText("unknown");
  await expect(page.locator('[data-runtime-error="true"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("狭いviewportでも全体表示で動的Foldを画面内へ収める", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 628 });
  await page.goto("/");

  const toolPaneToggle = page.getByRole("button", { name: "toggle tool pane (T)" });
  await toolPaneToggle.click();
  const route = page.locator(".psi-node").first();
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/api/decompose",
  );
  await route.getByRole("button", { name: "分解を実行" }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(page.locator(".fold-unit-node")).toHaveCount(3);

  await page.locator(".shell").press("Home");
  await expect.poll(async () => page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".react-flow__node"));
    const topbar = document.querySelector<HTMLElement>(".topbar")?.getBoundingClientRect();
    const margin = 2;
    return {
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      outside: nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < -margin || rect.right > innerWidth + margin || rect.top < (topbar?.bottom ?? 0) - margin || rect.bottom > innerHeight + margin;
      }).map((node) => node.getAttribute("data-id")),
    };
  })).toEqual({ horizontalOverflow: false, outside: [] });
});
