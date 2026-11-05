import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { MobileNav } from "@/components/layout/MobileNav";
import { NavLinks } from "@/components/layout/NavLinks";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { Logo } from "@/components/shared/Logo";

beforeEach(() => {
  nav.pathname = "/";
});

describe("Navbar links", () => {
  it("marks only the current section with aria-current", () => {
    nav.pathname = "/runs/abc";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Runs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("moves the active marker when the route changes", () => {
    const { rerender } = render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    nav.pathname = "/settings";
    rerender(<NavLinks />);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});

describe("MobileNav", () => {
  it("opens from the hamburger, lists the four links and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    const links = within(dialog).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Dashboard", "Runs", "Import", "Settings"]);
    expect(within(dialog).getByRole("button", { name: "Log out" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes when the route changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MobileNav />);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await screen.findByRole("dialog");
    nav.pathname = "/runs";
    rerender(<MobileNav />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes with the close button", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(await screen.findByRole("button", { name: "Close menu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("ConfirmDialog", () => {
  const base = {
    title: "Revoke token?",
    description: "The helper will stop working.",
    confirmLabel: "Revoke",
  };

  it("focuses Cancel first, never the destructive button", async () => {
    render(
      <ConfirmDialog
        {...base}
        open
        onOpenChange={() => {}}
        tone="destructive"
        onConfirm={() => {}}
      />,
    );
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(screen.getByRole("button", { name: "Revoke" })).not.toHaveFocus();
  });

  it("shows a pending state and disables Cancel while confirming, then closes", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...base} open onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Revoke|Loading/ })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await act(async () => release());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows the error inline and stays open when confirming fails", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        {...base}
        open
        onOpenChange={onOpenChange}
        onConfirm={async () => {
          throw new Error("The server didn't respond.");
        }}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The server didn't respond.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("CopyButton", () => {
  it("copies, shows Copied for 2s, then returns to idle", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="scr_abc" label="Copy token" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy token" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Copied/ })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("scr_abc");
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole("button", { name: "Copy token" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("falls back and reports failure when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(false);
    render(<CopyButton value="x" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Couldn't copy/ })).toBeInTheDocument(),
    );
  });
});

describe("Logo", () => {
  it("has the accessible name Screener in both variants", () => {
    const { rerender } = render(<Logo />);
    expect(screen.getByRole("img", { name: "Screener" })).toBeInTheDocument();
    rerender(<Logo variant="glyph" />);
    expect(screen.getByRole("img", { name: "Screener" })).toBeInTheDocument();
    expect(screen.queryByText("SCREENER")).not.toBeInTheDocument();
  });
});
