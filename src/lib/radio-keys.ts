/**
 * The value a radio group should select after a key press, following the standard pattern: the arrow keys move to the
 * next or previous option (wrapping round), Home and End go to the ends, anything else changes nothing. Returns null
 * when the key is not one the group handles.
 */
export function nextRadioValue(key: string, values: readonly string[], current: string, rtl = false): string | null {
  if (values.length === 0) return null;
  const index = Math.max(0, values.indexOf(current));
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const backward = rtl ? "ArrowRight" : "ArrowLeft";
  if (key === "ArrowDown" || key === forward) return values[(index + 1) % values.length]!;
  if (key === "ArrowUp" || key === backward) return values[(index - 1 + values.length) % values.length]!;
  if (key === "Home") return values[0]!;
  if (key === "End") return values[values.length - 1]!;
  return null;
}
