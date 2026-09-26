/**
 * Whether a keystroke landed on something that has its own use for it.
 *
 * Space buzzes and single letters judge — but only when focus is on the game
 * itself (the page, the clue, the buzzer). A focused button, menu item or
 * field keeps its own keys, and anything inside a dialog or popover is left
 * alone entirely.
 */
export function keyBelongsToControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.dataset.buzzer === "true") return false;
  if (target.isContentEditable) return true;
  if (
    target.closest(
      'input, textarea, select, button, a[href], [role="button"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="tab"], [role="option"], [role="slider"], [role="dialog"], .MuiPopover-root, .MuiModal-root',
    )
  ) {
    return true;
  }
  return false;
}

/** Whether a keystroke landed in a text field, where letters are letters. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Whether it is polite to move focus to the buzzer: nothing else has it, or
 * it is already somewhere on the game surface (not in chat, not in a field).
 */
export function mayTakeFocus(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return true;
  if (isTyping(active)) return false;
  if (active instanceof HTMLElement && active.closest('[role="dialog"], .MuiPopover-root, .MuiModal-root')) {
    return false;
  }
  return active instanceof HTMLElement && Boolean(active.closest("[data-game-surface]"));
}

/** Id of the hidden field a touch buzz focuses, so iOS opens its keyboard. */
export const answerFocusProxyId = "answer-focus-proxy";
