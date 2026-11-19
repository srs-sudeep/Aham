// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { createI18n } from "@aham/ui-kit";
import { TestProviders } from "@aham/ui-kit/testing";
import en from "../../locales/en.json";
import { ItemStatusBadge } from "./ItemStatusBadge";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(TestProviders, null, children);
}

describe("ItemStatusBadge", () => {
  beforeAll(() => {
    // Registers the global react-i18next instance used by `useTranslation`.
    createI18n({ defaultLocale: "en", resources: { en } });
  });

  it.each([
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["draft", "Draft"],
  ] as const)("renders the translated label for %s", (status, label) => {
    render(<ItemStatusBadge status={status} />, { wrapper });
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
