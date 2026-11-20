---
name: Sandbox test port isolation
description: Avoid unintended preview-port changes from in-process Vite component tests.
---

In-process Vite test servers should not open WebSocket listeners, even when running in middleware mode with hot reload disabled.

**Why:** In this environment a test-only WebSocket listener was automatically registered as a persistent preview-port mapping. Disabling hot reload alone did not prevent the listener.

**How to apply:** Disable the WebSocket server as well for component-only test harnesses, close the test server after the run and check for unintended port-configuration changes. Keep the managed preview workflow separate from the test harness.
