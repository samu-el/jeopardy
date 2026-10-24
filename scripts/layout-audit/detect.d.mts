// Types for `detect.mjs`, so the TypeScript tests can import it without `allowJs`.

export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface LayoutNode {
  i: number;
  parent: number;
  label: string;
  rect: Box;
  vis: Box | null;
  decorative: boolean;
  layer: number;
  inHScroll: boolean;
  clip: number;
  clipOk: boolean;
  interactive: boolean;
  control: boolean;
  textX: number;
  textY: number;
  lineHeight: number;
  truncated: boolean;
  /** How far an element's own text runs past the box that clips it. */
  textClip?: number;
  abs: boolean;
  pad: { l: number; r: number } | null;
  flow: boolean;
  painted: boolean;
  contain: boolean;
  ellipsis: boolean;
  /** Which axes this element cuts off (absent: both). A scrolling axis does not. */
  clipAxes?: { x: boolean; y: boolean };
}

export interface LayoutBlock {
  label: string;
  left: number;
  right: number;
  inkLeft: number;
  inkRight: number;
  parentLeft?: number;
  parentRight?: number;
}

export interface LayoutRow {
  label: string;
  centers: { label: string; center: number }[];
}

export interface LayoutSnapshot {
  viewport: { w: number; h: number };
  doc: { scrollWidth: number; clientWidth: number };
  nodes: LayoutNode[];
  blocks: LayoutBlock[];
  rows: LayoutRow[];
}

export interface LayoutFinding {
  kind: string;
  label: string;
  detail: string;
}

export function collectLayout(): LayoutSnapshot;
export function analyzeLayout(snap: LayoutSnapshot): { findings: LayoutFinding[]; truncated: string[] };
