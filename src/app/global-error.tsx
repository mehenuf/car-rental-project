"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself — the one case
 * `(site)/error.tsx` and `admin/error.tsx` can't cover, since both sit
 * inside the root layout. Next requires this file to render its own
 * <html>/<body>, replacing the entire page, so it can't lean on any
 * shared layout or component that might itself be the thing that broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#0b0f19",
          color: "#f4f4f5",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a1a1aa", margin: 0, maxWidth: "28rem" }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.625rem 1.5rem",
            borderRadius: "0.5rem",
            border: "none",
            backgroundColor: "#f97316",
            color: "#0b0f19",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
