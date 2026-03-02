import { act, renderHook, waitFor } from "@testing-library/react";
import { useNoteRemoteSync } from "../hooks/useNoteRemoteSync";
import type { NoteRepository } from "../storage/noteRepository";
import { ok } from "../domain/result";

let mockOnline = true;
const getMockOnline = () => mockOnline;

jest.mock("../hooks/useConnectivity", () => ({
  useConnectivity: () => getMockOnline(),
}));

interface RefreshableRepository extends NoteRepository {
  refreshNote: (
    date: string,
  ) => Promise<
    | { ok: true; value: { date: string; content: string | null } | null }
    | { ok: false; error: Error }
    | { date: string; content: string | null }
    | null
  >;
  hasRemoteDateCached: (date: string) => Promise<boolean>;
  hasPendingOp: (date: string) => Promise<boolean>;
}

function createRepository(): RefreshableRepository {
  return {
    get: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    getAllDates: jest.fn(),
    refreshNote: jest.fn().mockResolvedValue(
      ok({
        date: "10-01-2026",
        content: "remote-content",
      }),
    ),
    hasRemoteDateCached: jest.fn().mockResolvedValue(true),
    hasPendingOp: jest.fn().mockResolvedValue(false),
  };
}

describe("useNoteRemoteSync", () => {
  beforeEach(() => {
    mockOnline = true;
  });

  it("applies remote refresh using latest refs", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();

    const { result, rerender } = renderHook(
      ({ date, localContent }) =>
        useNoteRemoteSync(date, repository, {
          onRemoteUpdate,
          localContent,
          hasLocalEdits: false,
          isLocalReady: true,
        }),
      {
        initialProps: { date: "10-01-2026", localContent: "local" },
      },
    );

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );

    rerender({ date: "11-01-2026", localContent: "local-2" });

    act(() => {
      result.current.triggerRefresh();
    });

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("11-01-2026"),
    );
    await waitFor(() => expect(onRemoteUpdate).toHaveBeenCalled());
  });

  it("retries refresh when repository instance changes", async () => {
    const repository = createRepository();
    const nextRepository = createRepository();
    const onRemoteUpdate = jest.fn();

    const { rerender } = renderHook(
      ({ repo }) =>
        useNoteRemoteSync("10-01-2026", repo, {
          onRemoteUpdate,
          localContent: "local",
          hasLocalEdits: false,
          isLocalReady: true,
        }),
      {
        initialProps: { repo: repository },
      },
    );

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );

    rerender({ repo: nextRepository });

    await waitFor(() =>
      expect(nextRepository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );
  });

  it("exposes known remote-only notes when offline", async () => {
    mockOnline = false;
    const repository = createRepository();

    const { result } = renderHook(() =>
      useNoteRemoteSync("10-01-2026", repository, {
        onRemoteUpdate: jest.fn(),
        localContent: "",
        hasLocalEdits: false,
        isLocalReady: true,
      }),
    );

    await waitFor(() => expect(result.current.isKnownRemoteOnly).toBe(true));
  });

  it("refreshes remote notes even when local content is empty", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();

    renderHook(() =>
      useNoteRemoteSync("10-01-2026", repository, {
        onRemoteUpdate,
        localContent: "",
        hasLocalEdits: false,
        isLocalReady: true,
      }),
    );

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );
    await waitFor(() => expect(onRemoteUpdate).toHaveBeenCalled());
  });

  it("forceRefresh triggers refresh even after initial refresh completed", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();

    const { result } = renderHook(() =>
      useNoteRemoteSync("10-01-2026", repository, {
        onRemoteUpdate,
        localContent: "local",
        hasLocalEdits: false,
        isLocalReady: true,
      }),
    );

    // Wait for initial refresh
    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );

    // Clear mock to track new calls
    (repository.refreshNote as jest.Mock).mockClear();
    onRemoteUpdate.mockClear();

    // Force refresh should trigger another refresh even though we already refreshed
    act(() => {
      result.current.forceRefresh();
    });

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );
    await waitFor(() => expect(onRemoteUpdate).toHaveBeenCalled());
  });

  it("forceRefresh does not refresh when user has local edits", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();

    const { result, rerender } = renderHook(
      ({ hasLocalEdits }) =>
        useNoteRemoteSync("10-01-2026", repository, {
          onRemoteUpdate,
          localContent: "local",
          hasLocalEdits,
          isLocalReady: true,
        }),
      { initialProps: { hasLocalEdits: false } },
    );

    // Wait for initial refresh
    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );

    // Rerender with local edits
    rerender({ hasLocalEdits: true });

    // Clear mock to track new calls
    (repository.refreshNote as jest.Mock).mockClear();
    onRemoteUpdate.mockClear();

    // Force refresh - should trigger refresh but not apply update due to edits
    act(() => {
      result.current.forceRefresh();
    });

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledWith("10-01-2026"),
    );

    // onRemoteUpdate should NOT be called because hasLocalEdits is true
    // Give it some time to potentially be called incorrectly
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRemoteUpdate).not.toHaveBeenCalled();
  });

  it("retries refresh when previous refresh returned null", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();

    // First refresh returns null (no remote note found)
    (repository.refreshNote as jest.Mock).mockResolvedValueOnce(ok(null));

    const { result } = renderHook(() =>
      useNoteRemoteSync("10-01-2026", repository, {
        onRemoteUpdate,
        localContent: "local",
        hasLocalEdits: false,
        isLocalReady: true,
      }),
    );

    // Wait for first refresh attempt (returns null → REFRESH_SKIPPED, no markRefreshed)
    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledTimes(1),
    );

    // onRemoteUpdate should not have been called
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRemoteUpdate).not.toHaveBeenCalled();

    // Force refresh should retry since date was NOT marked as refreshed
    (repository.refreshNote as jest.Mock).mockResolvedValueOnce(
      ok({ date: "10-01-2026", content: "remote-content" }),
    );

    act(() => {
      result.current.forceRefresh();
    });

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(onRemoteUpdate).toHaveBeenCalledWith("remote-content"),
    );
  });

  it("retries refresh when previous refresh errored", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    // First refresh throws an error
    (repository.refreshNote as jest.Mock).mockRejectedValueOnce(
      new Error("network error"),
    );

    const { result } = renderHook(() =>
      useNoteRemoteSync("10-01-2026", repository, {
        onRemoteUpdate,
        localContent: "local",
        hasLocalEdits: false,
        isLocalReady: true,
      }),
    );

    // Wait for first refresh attempt (error → REFRESH_SKIPPED, no markRefreshed)
    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledTimes(1),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRemoteUpdate).not.toHaveBeenCalled();

    // Force refresh should retry since date was NOT marked as refreshed
    (repository.refreshNote as jest.Mock).mockResolvedValueOnce(
      ok({ date: "10-01-2026", content: "remote-content" }),
    );

    act(() => {
      result.current.forceRefresh();
    });

    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(onRemoteUpdate).toHaveBeenCalledWith("remote-content"),
    );

    consoleSpy.mockRestore();
  });

  it("retries on INPUTS_CHANGED after refresh returned null (no markRefreshed)", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();

    // First refresh returns null (server has no note, or error unwrapped to null)
    (repository.refreshNote as jest.Mock).mockResolvedValueOnce(ok(null));

    const { rerender } = renderHook(
      ({ online }) => {
        mockOnline = online;
        return useNoteRemoteSync("10-01-2026", repository, {
          onRemoteUpdate,
          localContent: "",
          hasLocalEdits: false,
          isLocalReady: true,
        });
      },
      { initialProps: { online: true } },
    );

    // Wait for first refresh attempt (returns null → REFRESH_SKIPPED, no markRefreshed)
    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledTimes(1),
    );
    expect(onRemoteUpdate).not.toHaveBeenCalled();

    // Second attempt returns real content
    (repository.refreshNote as jest.Mock).mockResolvedValueOnce(
      ok({ date: "10-01-2026", content: "remote-content" }),
    );

    // Toggle online off then on to trigger INPUTS_CHANGED
    rerender({ online: false });
    rerender({ online: true });

    // Should retry because hasRefreshedForDate was NOT set
    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(onRemoteUpdate).toHaveBeenCalledWith("remote-content"),
    );
  });

  it("does not auto-retry on INPUTS_CHANGED after successful refresh", async () => {
    const repository = createRepository();
    const onRemoteUpdate = jest.fn();

    const { rerender } = renderHook(
      ({ localContent }) =>
        useNoteRemoteSync("10-01-2026", repository, {
          onRemoteUpdate,
          localContent,
          hasLocalEdits: false,
          isLocalReady: true,
        }),
      { initialProps: { localContent: "local" } },
    );

    // Wait for initial refresh to complete with REMOTE_REFRESHED (marks refreshed)
    await waitFor(() =>
      expect(repository.refreshNote).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(onRemoteUpdate).toHaveBeenCalled());

    (repository.refreshNote as jest.Mock).mockClear();

    // Trigger INPUTS_CHANGED — should NOT re-refresh since date is marked
    rerender({ localContent: "remote-content" });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(repository.refreshNote).not.toHaveBeenCalled();
  });
});
