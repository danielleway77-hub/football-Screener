import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => nav,
}));
const fetcher = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("@/lib/fetcher", async (orig) => ({
  ...(await orig<typeof import("@/lib/fetcher")>()),
  fetchJson: fetcher.fetchJson,
}));

import { RunButton } from "@/components/dashboard/RunButton";
import { useRunNow } from "@/components/dashboard/useRunNow";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineBanner } from "@/components/states/OfflineBanner";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}
beforeEach(() => {
  setOnline(true);
  nav.refresh.mockReset();
  fetcher.fetchJson.mockReset();
});
afterEach(() => vi.useRealTimers());

function Harness() {
  const run = useRunNow();
  return <RunButton canPull run={run} />;
}

describe("Run now resilience", () => {
  it("shows the slow hint after 3 s of pending and never fires twice on double click", async () => {
    vi.useFakeTimers();
    fetcher.fetchJson.mockReturnValue(new Promise(() => {})); // never settles
    render(<Harness />);
    const button = screen.getByRole("button", { name: /run now/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetcher.fetchJson).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Still working/)).toBeNull();
    await act(async () => void vi.advanceTimersByTime(3100));
    expect(screen.getByText(/Still working/)).toBeInTheDocument();
  });

  it("is disabled with a visible reason while offline", () => {
    setOnline(false);
    render(<Harness />);
    expect(screen.getByRole("button", { name: /run now/i })).toBeDisabled();
    expect(screen.getByText(/You're offline\. Reconnect to run a check/)).toBeVisible();
  });
});

describe("Logout while offline", () => {
  it("is disabled and explains why", () => {
    setOnline(false);
    render(
      <TooltipProvider>
        <LogoutButton variant="row" />
      </TooltipProvider>,
    );
    const b = screen.getByRole("button", { name: /log out/i });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("title", expect.stringContaining("offline"));
  });
});

describe("OfflineBanner recovery", () => {
  it("offers a Refresh that re-reads the view (and nothing else is replayed)", async () => {
    render(<OfflineBanner />);
    act(() => setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent("offline");
    act(() => setOnline(true));
    const refresh = await screen.findByRole("button", { name: "Refresh" });
    fireEvent.click(refresh);
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    expect(fetcher.fetchJson).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Back online."));
  });
});

describe("OfflineBanner rapid toggling", () => {
  it("a second 'Back online.' is not hidden early by the first timer", () => {
    vi.useFakeTimers();
    render(<OfflineBanner />);
    act(() => setOnline(false));
    act(() => setOnline(true)); // first timer: hides at t=3000
    act(() => void vi.advanceTimersByTime(2000));
    act(() => setOnline(false));
    act(() => setOnline(true)); // second timer: hides at t=5000
    act(() => void vi.advanceTimersByTime(1500)); // t=3500: first timer would have fired
    expect(screen.getByRole("status")).toHaveTextContent("Back online.");
    act(() => void vi.advanceTimersByTime(1600));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("401 redirect guard", () => {
  it("concurrent 401s navigate to /login?next= exactly once", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { pathname: "/runs", search: "?page=2", assign });
    const real = await import("@/lib/fetcher");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    const { fetchJson: realFetch } =
      await vi.importActual<typeof import("@/lib/fetcher")>("@/lib/fetcher");
    await Promise.allSettled([realFetch("/api/a"), realFetch("/api/b"), realFetch("/api/c")]);
    vi.unstubAllGlobals();
    expect(real).toBeTruthy();
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/login?next=%2Fruns%3Fpage%3D2");
  });
});

describe("Run now timeout copy", () => {
  it("says the check may already be running and refreshes instead of inviting a retry", async () => {
    const { AppClientError } = await import("@/lib/fetcher");
    fetcher.fetchJson.mockRejectedValue(new AppClientError("TIMEOUT", "slow"));
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    expect(await screen.findByText(/may already be running/)).toBeInTheDocument();
    expect(nav.refresh).toHaveBeenCalled();
    expect(screen.queryByText(/try again/i)).toBeNull();
  });
});

describe("Logout row offline reason", () => {
  it("is visible text, not only a title", () => {
    setOnline(false);
    render(
      <TooltipProvider>
        <LogoutButton variant="row" />
      </TooltipProvider>,
    );
    expect(screen.getByText("You're offline. Reconnect to log out.")).toBeVisible();
  });
});
