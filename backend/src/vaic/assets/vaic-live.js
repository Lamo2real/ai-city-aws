/* AI City's live preview helper. Added by the city only to the live working copy of an app being built
   (drafts/prv-…/), never to a published app. It keeps the frame's scroll position across reloads and shows
   where the builders last changed something: a labelled pointer on that element and a soft pulse around it.
   The HUD passes the marks in the address (?marks=[{label, selector, color}]); nothing leaves the frame. */
/* global window, document, location, URLSearchParams, requestAnimationFrame */
(function () {
  "use strict";
  var KEY = "vaic-live:";

  function restore() {
    var n = String(window.name || "");
    if (n.indexOf(KEY) !== 0) return;
    var y = parseInt(n.slice(KEY.length), 10);
    if (y > 0) window.scrollTo(0, y);
  }

  var pending = false;
  window.addEventListener(
    "scroll",
    function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        window.name = KEY + Math.round(window.scrollY || 0);
      });
    },
    { passive: true },
  );

  function marks() {
    try {
      var raw = new URLSearchParams(location.search).get("marks");
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(0, 8) : [];
    } catch (e) {
      return [];
    }
  }

  function el(tag, css) {
    var e = document.createElement(tag);
    e.setAttribute("data-vaic-live", "");
    e.style.cssText = css;
    return e;
  }

  function show() {
    var style = el("style", "");
    style.textContent =
      "@keyframes vaic-live-pulse{0%{box-shadow:0 0 0 0 var(--c);opacity:1}70%{box-shadow:0 0 0 10px transparent;opacity:1}100%{box-shadow:0 0 0 0 transparent;opacity:0}}";
    document.head.appendChild(style);
    marks().forEach(function (m) {
      if (!m || typeof m.selector !== "string" || !m.selector) return;
      var target = null;
      try {
        target = document.querySelector(m.selector);
      } catch (e) {
        return;
      }
      if (!target || !target.getBoundingClientRect) return;
      var r = target.getBoundingClientRect();
      var x = r.left + window.scrollX;
      var y = r.top + window.scrollY;
      var color = /^#[0-9a-fA-F]{3,8}$/.test(String(m.color)) ? m.color : "#7dd3fc";
      var ring = el(
        "div",
        "position:absolute;pointer-events:none;z-index:2147483646;border-radius:6px;border:2px solid " +
          color +
          ";--c:" +
          color +
          ";left:" +
          (x - 3) +
          "px;top:" +
          (y - 3) +
          "px;width:" +
          (r.width + 2) +
          "px;height:" +
          (r.height + 2) +
          "px;animation:vaic-live-pulse 1.6s ease-out 2 forwards",
      );
      var pointer = el(
        "div",
        "position:absolute;pointer-events:none;z-index:2147483647;left:" +
          (x + Math.min(r.width, 40)) +
          "px;top:" +
          (y + Math.min(r.height, 24)) +
          "px;font:600 11px/1.2 system-ui,sans-serif;color:#0b1020;transition:opacity .6s",
      );
      var arrow = el(
        "div",
        "width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid " +
          color +
          ";transform:rotate(-30deg);margin-bottom:2px",
      );
      var tag = el(
        "div",
        "background:" + color + ";padding:3px 7px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)",
      );
      tag.textContent = String(m.label || "Builder").slice(0, 30);
      pointer.appendChild(arrow);
      pointer.appendChild(tag);
      document.body.appendChild(ring);
      document.body.appendChild(pointer);
    });
  }

  function start() {
    restore();
    try {
      show();
    } catch (e) {
      /* the marks are a help; the app runs regardless */
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  window.addEventListener("load", restore);
})();
