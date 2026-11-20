'use client';

export default function OwnerError({ reset }: { reset: () => void }) {
  return <div role="alert" style={{ padding: 24 }}>
    <h1>Unable to load this page</h1>
    <p>Live data could not be loaded. No sample activity is being substituted.</p>
    <button type="button" onClick={reset}>Try again</button>
    <p><a href="/owner">Back to Dashboard</a></p>
  </div>;
}
