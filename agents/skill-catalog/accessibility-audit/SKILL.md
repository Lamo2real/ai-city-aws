---
name: accessibility-audit
description: "Audit a page or screen against WCAG 2.2 AA: contrast, keyboard, screen readers, touch targets and motion, with fixes."
---
# Accessibility audit

- Run an automated check (axe or Lighthouse) first, then check by hand; automated tools find about a third of problems.
- Keyboard: every control reachable and usable with Tab, Enter, Space and Escape; visible focus; a sensible order; no traps.
- Screen reader: headings in order, every control and image has a name, form fields have labels, errors are announced.
- Contrast: 4.5:1 for text, 3:1 for large text and controls, in light and dark themes.
- Touch targets at least 24×24 px (44 on phones), zoom to 200% without loss, no information by colour alone, reduced motion respected.
- Output: issues by severity with the WCAG criterion, where it is, and the fix.
