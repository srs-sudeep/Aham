import { describe, expect, it } from "vitest";
import type { ItemsSearch } from "../model/item.schema";
import { itemsKeys } from "./items.keys";

const search: ItemsSearch = { page: 1, pageSize: 20, q: "bolt", status: "active" };

describe("itemsKeys", () => {
  it("scopes every key to the tenant id", () => {
    const keys = [
      itemsKeys.all("t1"),
      itemsKeys.lists("t1"),
      itemsKeys.list("t1", search),
      itemsKeys.options("t1"),
      itemsKeys.details("t1"),
      itemsKeys.detail("t1", "item-1"),
    ];
    for (const key of keys) expect(key[2]).toBe("t1");
  });

  it("nests list and detail keys under all(tenantId)", () => {
    const root = itemsKeys.all("t1");
    expect(itemsKeys.list("t1", search).slice(0, root.length)).toEqual(root);
    expect(itemsKeys.detail("t1", "item-1").slice(0, root.length)).toEqual(root);
  });

  it("has the expected list/detail shape", () => {
    expect(itemsKeys.list("t1", search)).toEqual(["catalog", "items", "t1", "list", search]);
    expect(itemsKeys.detail("t1", "item-1")).toEqual([
      "catalog",
      "items",
      "t1",
      "detail",
      "item-1",
    ]);
  });

  it("produces different keys for different tenants", () => {
    expect(itemsKeys.list("t1", search)).not.toEqual(itemsKeys.list("t2", search));
    expect(itemsKeys.detail("t1", "a")).not.toEqual(itemsKeys.detail("t2", "a"));
  });

  it("accepts a null tenant", () => {
    expect(itemsKeys.all(null)).toEqual(["catalog", "items", null]);
  });
});
