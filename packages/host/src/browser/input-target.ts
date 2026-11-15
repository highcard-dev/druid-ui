/** Embedded native controls retain their input, selection and browser behavior. */
export const interactive = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(
    "input, textarea, select, button, a, video, audio, [contenteditable]:not([contenteditable=false]), [role=button], [role=textbox], [role=combobox], [role=slider]",
  );
