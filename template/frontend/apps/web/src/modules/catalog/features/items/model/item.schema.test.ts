import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./item.constants";
import { itemsSearchSchema } from "./item.schema";

describe("itemsSearchSchema", () => {
  it("applies defaults for an empty search", () => {
    expect(itemsSearchSchema.parse({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      q: undefined,
      status: undefined,
    });
  });

  it("coerces numeric strings from the URL", () => {
    const parsed = itemsSearchSchema.parse({ page: "3", pageSize: "50", status: "draft" });
    expect(parsed).toMatchObject({ page: 3, pageSize: 50, status: "draft" });
  });

  it("falls back to defaults for invalid values", () => {
    const parsed = itemsSearchSchema.parse({
      page: "0",
      pageSize: MAX_PAGE_SIZE + 1,
      status: "bogus",
    });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsed.status).toBeUndefined();
  });
});
