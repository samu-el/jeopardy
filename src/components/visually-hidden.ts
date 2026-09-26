/** Present for assistive technology, invisible on screen. */
export const visuallyHiddenSx = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
