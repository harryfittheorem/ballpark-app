import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { act, create } from "react-test-renderer";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

// Component-level interaction tests: mount the actual parent, not isolated
// children with hand-written props, so integration prop regressions are caught.
let server;
let CRMWorkbench;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Map();
globalThis.window = {
  location: { search: "" },
  history: { replaceState() {} },
  innerWidth: 1440,
  setTimeout: () => 0,
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: (name) => listeners.delete(name),
};
globalThis.document = { activeElement: null };

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("../", import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  ({ CRMWorkbench } = await server.ssrLoadModule(
    "/src/components/mockups/clubhouse-crm/CRMWorkbench.tsx",
  ));
});
after(async () => { await server?.close(); });

function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return (node?.children ?? []).map(text).join("");
}
function button(root, label) {
  const found = root.findAllByType("button").find(node => text(node) === label);
  assert.ok(found, `Missing button: ${label}`);
  return found;
}
function nodeButton(root, title) {
  const found = root.findAllByType("button").find(
    node => node.props.className?.split(" ").includes("flow-node") &&
      text(node).includes(title),
  );
  assert.ok(found, `Missing workflow node: ${title}`);
  return found;
}
async function mount(search) {
  window.location.search = search;
  let renderer;
  await act(async () => { renderer = create(React.createElement(CRMWorkbench)); });
  return renderer;
}

test("select, edit and delete non-trigger nodes through the actual workbench", async () => {
  const renderer = await mount("?view=workflows");
  const root = renderer.root;
  try {
    for (const title of ["Send a personal introduction", "Wait 2 days"]) {
      await act(async () => { nodeButton(root, title).props.onClick(); });
      assert.equal(root.findByProps({ id: "node-title" }).props.value, title);

      const edited = `${title} · reviewed`;
      await act(async () => {
        root.findByProps({ id: "node-title" }).props.onChange({
          target: { value: edited },
        });
        root.findByProps({ id: "node-timing" }).props.onChange({
          target: { value: "Appointment-relative · recalculate after move" },
        });
      });
      assert.equal(root.findByProps({ id: "node-title" }).props.value, edited);
      assert.equal(
        root.findByProps({ id: "node-timing" }).props.value,
        "Appointment-relative · recalculate after move",
      );
      assert.ok(nodeButton(root, "New evaluation lead"), "Trigger was changed");
      assert.ok(nodeButton(root, edited));

      await act(async () => {
        root.findByProps({ "aria-label": "Delete selected node" }).props.onClick();
      });
      assert.equal(root.findAllByType("button").some(
        node => node.props.className?.split(" ").includes("flow-node") &&
          text(node).includes(edited),
      ), false, "The selected non-trigger node was not deleted");
      assert.ok(nodeButton(root, "New evaluation lead"), "Trigger was deleted");
    }
  } finally {
    await act(async () => { renderer.unmount(); });
  }
});

test("AND/OR audience changes update the actual computed parent preview", async () => {
  const renderer = await mount("?view=tags%20%26%20audiences");
  const root = renderer.root;
  try {
    assert.equal(root.findByProps({ id: "audience-join" }).props.value, "AND");
    await act(async () => {
      root.findByProps({ id: "audience-tags" }).props.onChange({
        target: { selectedOptions: [{ value: "Trial" }] },
      });
    });

    async function includedAdults() {
      await act(async () => {
        button(root, "Review computed preview").props.onClick();
      });
      const dialog = root.findByProps({ role: "dialog" });
      const result = text(dialog).split("Excluded")[0];
      await act(async () => {
        dialog.findByProps({ "aria-label": "Close dialog" }).props.onClick();
      });
      return result;
    }

    const andPreview = await includedAdults();
    assert.match(andPreview, /Theo Rivera/);
    assert.doesNotMatch(andPreview, /Mara Chen/);
    assert.doesNotMatch(andPreview, /Jordan Alvarez/);

    await act(async () => {
      root.findByProps({ id: "audience-join" }).props.onChange({
        target: { value: "OR" },
      });
    });
    assert.equal(root.findByProps({ id: "audience-join" }).props.value, "OR");
    const orPreview = await includedAdults();
    assert.match(orPreview, /Theo Rivera/);
    assert.match(orPreview, /Mara Chen/);
    assert.match(orPreview, /Jordan Alvarez/);
    assert.doesNotMatch(orPreview, /Nina Patel/, "Cross-location adult included");
    assert.doesNotMatch(orPreview, /Priya Shah/, "Opted-out adult included");

    await act(async () => {
      root.findByProps({ id: "audience-join" }).props.onChange({
        target: { value: "AND" },
      });
    });
    const finalPreview = await includedAdults();
    assert.match(finalPreview, /Theo Rivera/);
    assert.doesNotMatch(finalPreview, /Mara Chen/);
  } finally {
    await act(async () => { renderer.unmount(); });
  }
});
