import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { MATCH_CARD_MIN_HEIGHT_CLASS } from "@/components/match/dimensions";
import { AppErrorBoundary } from "@/components/states/AppErrorBoundary";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { RouteProgress } from "@/components/states/RouteProgress";
import { SlowHint } from "@/components/states/SlowHint";
import { MatchCardSkeleton, PageSkeleton } from "@/components/states/Skeletons";
import { StaleBanner } from "@/components/states/StaleBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSlowRequest } from "@/hooks/useSlowRequest";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

beforeEach(() => {
  nav.pathname = "/";
  nav.search = "";
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});
afterEach(() => vi.useRealTimers());

describe("useOnlineStatus", () => {
  it("reacts to offline and online events", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => setOnline(false));
    expect(result.current).toBe(false);
    act(() => setOnline(true));
    expect(result.current).toBe(true);
  });
});

describe("useSlowRequest", () => {
  it("turns true after 3000ms of pending and resets when the request settles", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ pending }) => useSlowRequest(pending), {
      initialProps: { pending: true },
    });
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(2999));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(2));
    expect(result.current).toBe(true);
    rerender({ pending: false });
    expect(result.current).toBe(false);
  });

  it("never fires when the request finishes before the threshold", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ pending }) => useSlowRequest(pending), {
      initialProps: { pending: true },
    });
    act(() => void vi.advanceTimersByTime(1000));
    rerender({ pending: false });
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
  });
});

describe("SlowHint", () => {
  it("renders only while active", () => {
    const { rerender } = render(<SlowHint active={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<SlowHint active />);
    expect(screen.getByRole("status")).toHaveTextContent("Still working");
  });
});

describe("ErrorState", () => {
  it("shows a friendly message and never a stack trace; the code lives in the details", () => {
    render(<ErrorState message="Couldn't load matches." code="TIMEOUT" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load matches.");
    expect(screen.queryByText(/at \w+ \(/)).not.toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByText(/Error code: TIMEOUT/)).toBeInTheDocument();
  });

  it("disables the retry button while pending and does not double-fire", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onRetry = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    render(<ErrorState onRetry={onRetry} />);
    const button = screen.getByRole("button", { name: /Try again/ });
    await user.click(button);
    await user.click(button);
    await user.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-busy", "true");
    await act(async () => release());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Try again/ })).not.toHaveAttribute("aria-busy"),
    );
  });

  it("has no retry button when no handler is given", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title, description and actions", () => {
    render(
      <EmptyState
        title="No matches yet"
        description="Run your first check."
        actions={<button>Run now</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No matches yet" })).toBeInTheDocument();
    expect(screen.getByText("Run your first check.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeInTheDocument();
  });
});

describe("OfflineBanner", () => {
  it("shows the offline message, then 'Back online.' for 3s, then disappears", () => {
    vi.useFakeTimers();
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent("You're offline");

    act(() => setOnline(true));
    expect(screen.getByRole("status")).toHaveTextContent("Back online.");
    act(() => void vi.advanceTimersByTime(2900));
    expect(screen.getByRole("status")).toHaveTextContent("Back online.");
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays silent when the page was never offline", () => {
    render(<OfflineBanner />);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("StaleBanner", () => {
  it("states the age with correct pluralisation and shows the action", () => {
    const { rerender } = render(<StaleBanner hours={31} action={<button>Update data</button>} />);
    expect(screen.getByRole("status")).toHaveTextContent("Data is 31 hours old.");
    expect(screen.getByRole("button", { name: "Update data" })).toBeInTheDocument();
    rerender(<StaleBanner hours={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("Data is 1 hour old.");
  });
});

describe("AppErrorBoundary", () => {
  function Bomb({ explode }: { explode: boolean }) {
    if (explode) throw new Error("secret internal detail");
    return <p>healthy</p>;
  }

  it("shows ErrorState (no raw message) and recovers via Try again", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let explode = true;
    const { rerender } = render(
      <AppErrorBoundary>
        <Bomb explode={explode} />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();

    explode = false;
    rerender(
      <AppErrorBoundary>
        <Bomb explode={explode} />
      </AppErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: /Try again/ }));
    expect(screen.getByText("healthy")).toBeInTheDocument();
  });
});

describe("Skeletons", () => {
  it("MatchCardSkeleton uses the shared card height constant (zero layout shift)", () => {
    const { container } = render(<MatchCardSkeleton />);
    expect(container.innerHTML).toContain(MATCH_CARD_MIN_HEIGHT_CLASS);
  });

  it("announces 'Loading…' once per group with aria-busy, shapes are hidden", () => {
    render(<PageSkeleton variant="dashboard" />);
    const groups = screen.getAllByRole("status");
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach((g) => expect(g).toHaveAttribute("aria-busy", "true"));
    expect(screen.getAllByText("Loading…").length).toBe(groups.length);
  });

  it.each(["dashboard", "detail", "table", "form"] as const)(
    "PageSkeleton %s renders a header block",
    (variant) => {
      const { container } = render(<PageSkeleton variant={variant} />);
      expect(container.querySelector('[data-testid="header-skeleton"]')).not.toBeNull();
    },
  );
});

describe("RouteProgress", () => {
  function link(href: string) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = "go";
    document.body.appendChild(a);
    return a;
  }
  const phase = () => screen.getByTestId("route-progress").getAttribute("data-phase");

  it("starts on an internal link click and completes when the URL changes", () => {
    vi.useFakeTimers();
    const { rerender } = render(<RouteProgress />);
    expect(phase()).toBe("idle");

    fireEvent.click(link("/runs"));
    expect(phase()).toBe("loading");

    nav.pathname = "/runs";
    rerender(<RouteProgress />);
    expect(phase()).toBe("done");
    act(() => void vi.advanceTimersByTime(400));
    expect(phase()).toBe("idle");
  });

  it("ignores external links, new-tab links, modified clicks and same-URL links", () => {
    render(<RouteProgress />);
    fireEvent.click(link("https://example.com/x"));
    expect(phase()).toBe("idle");
    const blank = link("/runs");
    blank.target = "_blank";
    fireEvent.click(blank);
    expect(phase()).toBe("idle");
    fireEvent.click(link("/runs"), { ctrlKey: true });
    expect(phase()).toBe("idle");
    fireEvent.click(link(window.location.pathname + window.location.search));
    expect(phase()).toBe("idle");
  });

  it("never gets stuck: a cancelled navigation resets after 10s", () => {
    vi.useFakeTimers();
    render(<RouteProgress />);
    fireEvent.click(link("/runs"));
    expect(phase()).toBe("loading");
    act(() => void vi.advanceTimersByTime(10_100));
    expect(phase()).toBe("idle");
  });
});
