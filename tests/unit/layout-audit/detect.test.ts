import { describe, expect, it } from "vitest";

import { analyzeLayout } from "../../../scripts/layout-audit/detect.mjs";

type Box = { l: number; t: number; r: number; b: number };

function node(i: number, rect: Box, extra: Record<string, unknown> = {}) {
  return {
    i,
    parent: -1,
    label: `n${i}`,
    rect,
    vis: rect,
    decorative: false,
    layer: -1,
    inHScroll: false,
    clip: -1,
    clipOk: false,
    interactive: false,
    control: false,
    textX: 0,
    textY: 0,
    lineHeight: 20,
    truncated: false,
    abs: false,
    pad: null,
    flow: false,
    painted: false,
    contain: false,
    ellipsis: false,
    ...extra,
  };
}

function snap(over: Partial<Parameters<typeof analyzeLayout>[0]> = {}) {
  return {
    viewport: { w: 400, h: 800 },
    doc: { scrollWidth: 400, clientWidth: 400 },
    nodes: [],
    blocks: [],
    rows: [],
    ...over,
  } as Parameters<typeof analyzeLayout>[0];
}

const kinds = (s: Parameters<typeof analyzeLayout>[0]) => analyzeLayout(s).findings.map((f) => f.kind);

describe("analyzeLayout", () => {
  it("passes a page where everything fits", () => {
    const nodes = [node(0, { l: 0, t: 0, r: 400, b: 100 }), node(1, { l: 16, t: 10, r: 384, b: 90 }, { parent: 0 })];
    expect(kinds(snap({ nodes }))).toEqual([]);
  });

  it("flags a page that scrolls sideways", () => {
    expect(kinds(snap({ doc: { scrollWidth: 430, clientWidth: 400 } }))).toEqual(["page-overflow"]);
  });

  it("flags the outermost element past the viewport, not each descendant", () => {
    const nodes = [
      node(0, { l: 0, t: 0, r: 440, b: 100 }),
      node(1, { l: 0, t: 0, r: 440, b: 50 }, { parent: 0 }),
    ];
    expect(kinds(snap({ nodes }))).toEqual(["viewport-overflow"]);
  });

  it("ignores content inside a sideways scroller and decorative glows", () => {
    const nodes = [
      node(0, { l: 0, t: 0, r: 900, b: 50 }, { inHScroll: true }),
      node(1, { l: -40, t: 0, r: 440, b: 300 }, { decorative: true }),
    ];
    expect(kinds(snap({ nodes }))).toEqual([]);
  });

  it("flags a child cut off by its clipping container unless the container allows it", () => {
    const frame = node(0, { l: 0, t: 0, r: 300, b: 300 });
    const bench = node(1, { l: 0, t: 260, r: 300, b: 340 }, { parent: 0, clip: 0 });
    expect(kinds(snap({ nodes: [frame, bench] }))).toEqual(["clipped"]);
    expect(kinds(snap({ nodes: [frame, { ...bench, clipOk: true }] }))).toEqual([]);
    expect(kinds(snap({ nodes: [{ ...frame, ellipsis: true }, bench] }))).toEqual([]);
  });

  it("does not flag content past an axis its container scrolls", () => {
    const tabs = node(0, { l: 0, t: 0, r: 300, b: 48 }, { clipAxes: { x: false, y: true } });
    const tab = node(1, { l: 200, t: 0, r: 380, b: 48 }, { parent: 0, clip: 0 });
    expect(kinds(snap({ nodes: [tabs, tab] }))).toEqual([]);
    expect(kinds(snap({ nodes: [{ ...tabs, clipAxes: { x: true, y: false } }, tab] }))).toEqual(["clipped"]);
  });

  it("flags in-flow content that pokes out of its parent's box", () => {
    const frame = node(0, { l: 100, t: 0, r: 400, b: 300 });
    const wrap = node(1, { l: 60, t: 300, r: 380, b: 380 }, { parent: 0, flow: true });
    const bar = node(2, { l: 60, t: 300, r: 380, b: 340 }, { parent: 1, flow: true, painted: true });
    const glow = node(3, { l: 60, t: 0, r: 440, b: 300 }, { parent: 0, painted: true });
    const back = node(4, { l: 92, t: 0, r: 128, b: 36 }, { parent: 0, flow: true });
    const nodes = [frame, wrap, bar, glow, back];
    expect(analyzeLayout(snap({ viewport: { w: 1000, h: 800 }, nodes })).findings.map((f) => f.label)).toEqual(["n2"]);
  });

  it("tells spilling text from tight display leading", () => {
    const tight = node(0, { l: 0, t: 0, r: 200, b: 80 }, { textY: 8, lineHeight: 80 });
    const spill = node(1, { l: 0, t: 0, r: 200, b: 20 }, { textY: 20, lineHeight: 20 });
    const wide = node(2, { l: 0, t: 0, r: 200, b: 20 }, { textX: 30 });
    expect(kinds(snap({ nodes: [tight] }))).toEqual([]);
    expect(kinds(snap({ nodes: [spill, wide] }))).toEqual(["text-overflow", "text-overflow"]);
  });

  it("flags text an element cuts off itself, beyond a tight line box", () => {
    const cut = node(0, { l: 0, t: 0, r: 200, b: 30 }, { textClip: 12, lineHeight: 16 });
    const snug = node(1, { l: 0, t: 0, r: 200, b: 30 }, { textClip: 3, lineHeight: 16 });
    expect(kinds(snap({ nodes: [cut, snug] }))).toEqual(["text-clipped"]);
  });

  it("flags overlapping controls but not an icon button padded into its field", () => {
    const a = node(0, { l: 0, t: 0, r: 100, b: 40 }, { interactive: true });
    const b = node(1, { l: 90, t: 0, r: 190, b: 40 }, { interactive: true });
    expect(kinds(snap({ nodes: [a, b] }))).toEqual(["overlap"]);

    const field = node(0, { l: 0, t: 0, r: 200, b: 40 }, { interactive: true, pad: { l: 12, r: 40 } });
    const eye = node(1, { l: 164, t: 6, r: 192, b: 34 }, { interactive: true, abs: true });
    expect(kinds(snap({ nodes: [field, eye] }))).toEqual([]);
  });

  it("does not compare a fixed bar with the content scrolling under it", () => {
    const a = node(0, { l: 0, t: 760, r: 400, b: 800 }, { interactive: true, layer: 0 });
    const b = node(1, { l: 0, t: 770, r: 400, b: 790 }, { interactive: true });
    expect(kinds(snap({ nodes: [a, b] }))).toEqual([]);
  });

  it("flags a block off the page's left edge but not a centred one", () => {
    const blocks = [
      { label: "header", left: 0, right: 400, inkLeft: 16, inkRight: 300 },
      { label: "cards", left: 0, right: 400, inkLeft: 24, inkRight: 376 },
      { label: "empty", left: 0, right: 400, inkLeft: 150, inkRight: 250 },
      { label: "button", left: 140, right: 260, inkLeft: 140, inkRight: 260, parentLeft: 0, parentRight: 400 },
    ];
    const findings = analyzeLayout(snap({ blocks })).findings;
    expect(findings.map((f) => [f.kind, f.label])).toEqual([["edge", "cards"]]);
  });

  it("flags controls in one row that do not share a centre line", () => {
    const rows = [
      { label: "ok", centers: [{ label: "a", center: 20 }, { label: "b", center: 20.5 }] },
      { label: "off", centers: [{ label: "a", center: 20 }, { label: "b", center: 26 }] },
    ];
    expect(analyzeLayout(snap({ rows })).findings.map((f) => f.label)).toEqual(["off"]);
  });
});
