// The reader enhancements for a rendered post, in the browser: reading progress, the table of contents' current section, code copy
// buttons, heading link copy, footnote previews, the image lightbox, Markdown copy, a link to the selected text and click-to-load
// embeds. It is dustinedwards-info's app/enhance/blog.ts moved here, so every site that renders with this pipeline decorates the same
// markup the same way. Every one is an addition: without script the page reads, links and opens images as plain HTML.
//
// Browser-only; its one import (render-embeds.mjs) is dependency-free too. Nothing runs on import; a site calls `enhance()` once the
// document is parsed.

import { embedPlayerUrl } from "./render-embeds.mjs";

// The directive matches the first occurrence, so a short phrase can land on the wrong paragraph.
const FRAGMENT_MIN_CHARS = 12;
const FRAGMENT_MAX_CHARS = 200;
const FRAGMENT_EDGE_WORDS = 6;

// Two viewports, not one: at one the bar describes a few pixels of scroll and jumps from empty to full.
const PROGRESS_MIN_VIEWPORTS = 2;

/** One name, moved from the figure to the full image and back, so the browser morphs one into the other. */
const GROW_NAME = "lightbox-figure";

const SELECTION_LABEL = "Copy link to selection";


let started = false;

/**
 * Copies text to the clipboard. Wrapped in a promise because with no clipboard (an insecure context) the call throws before any promise
 * exists, and every caller wants one failure path.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
const copyText = (text) => Promise.resolve().then(() => navigator.clipboard.writeText(text));

/**
 * `encodeURIComponent` leaves the hyphen, which the directive reserves: an unescaped one turns the rest of the passage into a suffix
 * match.
 *
 * @param {string} text
 */
const encodePart = (text) => encodeURIComponent(text).replace(/-/g, "%2D");

/**
 * The value for `#:~:text=`, or null when the selection is too short to find the right passage.
 *
 * @param {string} selected raw selected text, as `Selection.toString()` yields it
 * @returns {string | null}
 */
function textFragment(selected) {
  const text = selected.trim().replace(/[^\S\n]+/g, " ");
  if (text.length < FRAGMENT_MIN_CHARS) return null;

  const words = text.split(/\s+/);
  const edge = Math.min(FRAGMENT_EDGE_WORDS, words.length >> 1);

  // A selection crossing a block boundary (a newline from `Selection`) never matches as one exact string, and long passages are fragile
  // against whitespace differences, so both use the range form.
  if (edge > 0 && (text.length > FRAGMENT_MAX_CHARS || text.includes("\n"))) {
    return `${encodePart(words.slice(0, edge).join(" "))},${encodePart(words.slice(-edge).join(" "))}`;
  }
  return encodePart(text);
}

/**
 * Decorates the rendered post. A second call does nothing.
 *
 * @param {{ root?: string, toc?: string, article?: string }} [options] `root` is the rendered markup (default ".prose"), `toc` the
 *   table of contents (default ".post-toc") and `article` the post body the progress bar and selection link measure (default ".post .prose").
 * @returns {void}
 */
export function enhance(options = {}) {
  if (started) return;
  started = true;
  const { root = ".prose", toc: tocSelector = ".post-toc", article: articleSelector = ".post .prose" } = options;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** @param {() => void} fn */
  const onIdle = (fn) => {
    // Safari has no requestIdleCallback.
    if ("requestIdleCallback" in window) requestIdleCallback(fn);
    else setTimeout(fn, 1);
  };

  function readingProgress() {
    const article = document.querySelector(articleSelector);
    if (!(article instanceof HTMLElement)) return;

    const worthDrawing = () => article.offsetHeight >= window.innerHeight * PROGRESS_MIN_VIEWPORTS;
    if (!worthDrawing()) return;

    const bar = document.createElement("div");
    bar.className = "reading-progress";
    bar.setAttribute("role", "presentation");
    document.body.insertBefore(bar, document.body.firstChild);

    let ticking = false;
    const update = () => {
      bar.hidden = !worthDrawing();
      const top = article.offsetTop;
      const height = article.offsetHeight - window.innerHeight;
      const scrolled = height > 0 ? (window.scrollY - top) / height : 0;
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, scrolled))})`;
      ticking = false;
    };

    const schedule = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    addEventListener("scroll", schedule, { passive: true });
    // A rotation changes both the viewport and the article's height, so it re-asks the question.
    addEventListener("resize", schedule, { passive: true });
    update();
  }

  function scrollSpy() {
    const toc = document.querySelector(tocSelector);
    if (!toc) return;

    const links = Array.from(toc.querySelectorAll("a[href^='#']")).filter((link) => link instanceof HTMLAnchorElement);
    const targets = links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter((el) => el !== null);
    if (targets.length === 0) return;

    /** @type {Map<string, boolean>} */
    const seen = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const active = targets.find((t) => seen.get(t.id));
        for (const link of links) {
          // The state itself, not a styling hook, so a screen reader hears which section is current.
          if (active !== undefined && link.hash === `#${active.id}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        }
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const target of targets) observer.observe(target);
  }

  // One shared live region for every copy control: a live region announces changes to its own contents, so one per control would
  // compete. `role="status"` so it never interrupts reading.
  /** @type {HTMLElement | null} */
  let statusRegion = null;

  /** @param {string} message */
  function announce(message) {
    if (!statusRegion) {
      statusRegion = document.createElement("p");
      statusRegion.className = "sr-only";
      statusRegion.setAttribute("role", "status");
      document.body.appendChild(statusRegion);
    }
    // Cleared first: a live region announces a change, so writing the same string twice would be silent.
    statusRegion.textContent = "";
    requestAnimationFrame(() => {
      if (statusRegion) statusRegion.textContent = message;
    });
  }

  /** @param {HTMLElement} pre a `pre[data-lang]` from render-highlight.mjs */
  function decorateCodeBlock(pre) {
    // Tests for the button, not `data-enhanced`: the attribute can be lost while the button survives.
    if (pre.querySelector(":scope > .code-copy")) return;

    const lang = pre.dataset.lang;
    if (lang && lang !== "text") {
      const label = document.createElement("span");
      label.className = "code-lang";
      label.textContent = lang;
      label.setAttribute("aria-hidden", "true");
      pre.appendChild(label);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent ?? "";
      try {
        await copyText(code);
        button.textContent = "Copied";
        button.setAttribute("data-copied", "true");
        announce("Code copied");
      } catch {
        button.textContent = "Press Ctrl C";
        announce("Copy failed. Press Control C to copy.");
      }
      setTimeout(() => {
        button.textContent = "Copy";
        button.removeAttribute("data-copied");
      }, 2000);
    });
    pre.appendChild(button);

    // Last, so the padding never arrives before the thing it makes room for.
    pre.setAttribute("data-enhanced", "");
  }

  // Keeps observing so decoration does not depend on when this script runs relative to a subtree rewrite. It terminates:
  // `decorateCodeBlock` writes nothing to a `pre` that already has its button.
  function codeBlocks() {
    const decorateAll = () => {
      for (const pre of document.querySelectorAll(`${root} pre[data-lang]`)) {
        if (pre instanceof HTMLElement) decorateCodeBlock(pre);
      }
    };

    decorateAll();
    const prose = document.querySelector(root);
    if (prose) new MutationObserver(decorateAll).observe(prose, { childList: true, subtree: true });
  }

  function headingLinks() {
    for (const anchor of document.querySelectorAll(`${root} .heading-anchor`)) {
      anchor.addEventListener("click", (event) => {
        if (!navigator.clipboard) return;
        event.preventDefault();
        const url = new URL(anchor.getAttribute("href") ?? "", location.href);
        const heading = anchor.closest("h2, h3, h4") ?? document.getElementById(url.hash.slice(1));

        // `focus()` rather than `scrollIntoView`, so a screen reader announces the heading and the next Tab continues from it.
        // `tabindex="-1"` makes it focusable without adding it to the tab order.
        const land = () => {
          history.replaceState(null, "", url.hash);
          if (!(heading instanceof HTMLElement)) return;
          const had = heading.hasAttribute("tabindex");
          if (!had) heading.setAttribute("tabindex", "-1");
          heading.focus();
          // Removed on blur rather than immediately: taking it away while the element still holds focus drops focus to the body in
          // some engines.
          if (!had) heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
        };

        void copyText(url.href)
          .then(() => {
            anchor.setAttribute("data-copied", "true");
            setTimeout(() => anchor.removeAttribute("data-copied"), 1500);
            announce("Link copied");
          })
          // A refused clipboard must not cost the reader the navigation, so landing happens either way.
          .catch(() => announce("Copy failed. The link is in the address bar."))
          .finally(land);
      });
    }
  }

  function footnotePreviews() {
    if (!document.querySelector(`${root} .footnotes`)) return;

    /** @type {HTMLElement | null} */
    let bubble = null;
    // The reference being previewed, and the aria-describedby it had before ("footnote-label").
    /** @type {HTMLElement | null} */
    let owner = null;
    let prior = "";
    /** @type {ReturnType<typeof setTimeout> | null} */
    let pending = null;
    // A manual popover, so the top layer lifts it over everything and CSS anchor positioning keeps it under its reference. Without
    // anchor positioning it is placed once, in document coordinates. Every engine with anchor positioning shipped popover first, so one
    // probe answers both.
    const anchored = CSS.supports("anchor-name: --a");

    const cancelHide = () => {
      if (pending !== null) clearTimeout(pending);
      pending = null;
    };

    const hide = () => {
      cancelHide();
      bubble?.remove();
      bubble = null;
      owner?.setAttribute("aria-describedby", prior);
      owner = null;
    };

    // WCAG 1.4.13 hoverable: leaving the reference schedules a hide and entering the bubble cancels it, so the pointer can cross the gap
    // to the bubble.
    const HOVER_GRACE_MS = 220;
    const scheduleHide = () => {
      cancelHide();
      pending = setTimeout(hide, HOVER_GRACE_MS);
    };

    for (const ref of document.querySelectorAll(`${root} a[data-footnote-ref]`)) {
      if (!(ref instanceof HTMLAnchorElement)) continue;
      const show = () => {
        const target = document.getElementById(decodeURIComponent(ref.hash.slice(1)));
        if (!target) return;
        hide();
        const note = document.createElement("div");
        // One preview at a time, so its class can double as its id.
        note.id = note.className = "footnote-preview";
        note.setAttribute("role", "note");
        // A copy of the page's own rendered footnote, so it is as safe as the page.
        note.innerHTML = target.innerHTML;
        for (const back of note.querySelectorAll("[data-footnote-backref]")) back.remove();

        note.addEventListener("mouseenter", cancelHide);
        note.addEventListener("mouseleave", scheduleHide);

        // 1.3.1: the reference is described by the note it previews, so a screen reader hears it on focus.
        owner = ref;
        prior = ref.getAttribute("aria-describedby") ?? "";
        ref.setAttribute("aria-describedby", `${note.id} ${prior}`);
        document.body.appendChild(note);
        bubble = note;
        if (anchored) {
          note.popover = "manual";
          note.showPopover();
          return;
        }
        const box = ref.getBoundingClientRect();
        note.style.top = `${box.bottom + window.scrollY + 8}px`;
        note.style.left = `${Math.max(8, box.left + window.scrollX - 20)}px`;
      };
      ref.addEventListener("mouseenter", show);
      ref.addEventListener("focus", show);
      ref.addEventListener("mouseleave", scheduleHide);
      ref.addEventListener("blur", scheduleHide);
    }

    // Escape dismisses WITHOUT moving focus, as 1.4.13 asks.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && bubble) {
        event.stopPropagation();
        hide();
      }
    });
  }

  /**
   * The figure grows into the viewer and shrinks back, as a same-document View Transition. It carries no type, so a site's
   * cross-document page fade does not restyle it. Skipped under reduced motion, which a stylesheet's rule cannot reach from script, and
   * where the API is missing: then the change simply happens.
   *
   * @param {HTMLElement | undefined} from
   * @param {HTMLElement} to
   * @param {() => void} change
   */
  function grow(from, to, change) {
    if (!from || !("startViewTransition" in document) || reduceMotion.matches) {
      change();
      return;
    }
    from.style.viewTransitionName = GROW_NAME;
    const transition = document.startViewTransition(() => {
      from.style.viewTransitionName = "";
      to.style.viewTransitionName = GROW_NAME;
      change();
    });
    // A skipped transition rejects `ready` with an InvalidStateError: the tab went hidden, or another transition started first. The
    // update callback still ran, so the change happened and only the animation was dropped. Anything else is a real failure and is
    // rethrown to where it can be seen.
    void transition.ready.catch((/** @type {unknown} */ error) => {
      if (error instanceof DOMException && error.name === "InvalidStateError") return;
      throw error;
    });
    // The name is cleared once the morph ends, so no later transition picks up a stale pair.
    void transition.finished.finally(() => {
      to.style.viewTransitionName = "";
    });
  }

  /**
   * `src` is passed in rather than read from `currentSrc`, which is whichever `srcset` rung the browser downloaded: a resized copy shown
   * as full size. `restoreFocus` is passed because the opener is not always the element focus should land on.
   *
   * @param {string} src
   * @param {string} alt
   * @param {() => void} restoreFocus
   * @param {string | undefined} label
   * @param {HTMLElement | undefined} source
   */
  function openOverlay(src, alt, restoreFocus, label, source) {
    const dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    // Empty alt means decorative, so the dialog gets a generic label rather than an empty one. A diagram passes its own short label: its
    // alt describes every node and is too long for a name.
    dialog.setAttribute("aria-label", label ?? (alt || "Full size image"));
    if (reduceMotion.matches) dialog.dataset.reduced = "true";

    const full = document.createElement("img");
    full.src = src;
    full.alt = alt;
    dialog.appendChild(full);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "lightbox-close";
    close.textContent = "Close";
    dialog.appendChild(close);

    // The full image shrinks back into the figure it came from. Escape closes natively, without it.
    const dismiss = () => grow(full, source ?? full, () => dialog.close());
    close.addEventListener("click", dismiss);

    // On a `<dialog>` the element itself is the click target for its backdrop.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dismiss();
    });

    dialog.addEventListener("close", () => {
      dialog.remove();
      restoreFocus();
    });

    grow(source, full, () => {
      document.body.appendChild(dialog);
      dialog.showModal();
    });
  }

  function lightbox() {
    for (const link of document.querySelectorAll(`${root} a.image-link`)) {
      if (!(link instanceof HTMLAnchorElement)) continue;
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (!href) return;
        event.preventDefault();
        const image = link.querySelector("img");
        openOverlay(href, image?.alt ?? "", () => link.focus({ preventScroll: true }), undefined, image ?? undefined);
      });
    }

    // Diagram images are not wrapped in an anchor, and carry no `srcset`, so their `src` is the original.
    for (const image of document.querySelectorAll(`${root} img.diagram-image`)) {
      if (!(image instanceof HTMLImageElement)) continue;
      image.classList.add("zoomable");
      // A button to assistive technology and the keyboard too, not only to a pointer.
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Enlarge diagram: ${image.alt}`);
      const open = () => openOverlay(image.src, image.alt, () => image.focus({ preventScroll: true }), "Diagram, full size", image);
      image.addEventListener("click", open);
      image.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      });
    }
  }

  function copyMarkdown() {
    const trigger = document.querySelector("[data-copy-markdown]");
    if (!(trigger instanceof HTMLElement) || !navigator.clipboard) return;

    trigger.addEventListener("click", async (event) => {
      event.preventDefault();
      const original = trigger.textContent;
      const href = trigger.getAttribute("href") ?? "";
      try {
        const response = await fetch(href);
        // An error page is not the markdown: fail over to opening the link, which shows what went wrong.
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await copyText(await response.text());
        trigger.textContent = "Copied";
        trigger.setAttribute("data-copied", "true");
        announce("Markdown copied");
      } catch {
        location.href = href;
        return;
      }
      setTimeout(() => {
        trigger.textContent = original;
        trigger.removeAttribute("data-copied");
      }, 2000);
    });
  }

  // Script-only with no fallback: there is no scriptless way to read a selection, and the permalink is the equivalent path. Placed in
  // the flow after the selected block, it is the next tab stop. The origin comes from the permalink, never `location`.
  function selectionLink() {
    const article = document.querySelector(articleSelector);
    // The post's own permalink, else its canonical link, which every page headTags writes carries.
    const permalink = document.querySelector(".post-share .u-url") ?? document.querySelector('link[rel="canonical"]');
    if (!(article instanceof HTMLElement) || !(permalink instanceof HTMLAnchorElement || permalink instanceof HTMLLinkElement) || !navigator.clipboard) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "selection-link";
    button.textContent = SELECTION_LABEL;

    let url = "";
    let dragging = false;

    /** @param {Node} node */
    const blockOf = (node) => {
      let element = node instanceof Element ? node : node.parentElement;
      while (element && element !== article && element.parentElement !== article) element = element.parentElement;
      return element === article ? null : element;
    };

    const update = () => {
      const selection = getSelection();
      const fragment = selection?.isCollapsed ? null : textFragment(selection?.toString() ?? "");
      if (!selection || !fragment || !article.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        button.remove();
        return;
      }
      url = `${permalink.href}#:~:text=${fragment}`;
      button.textContent = SELECTION_LABEL;
      const block = blockOf(selection.getRangeAt(0).endContainer);
      // Only when not already there: `insertBefore` detaches a node that has a parent, and a target detached between pointerup and
      // click never gets the click.
      if (block && block.nextSibling !== button) article.insertBefore(button, block.nextSibling);
    };

    // A mousedown on the button would collapse the selection and take the button away with it.
    button.addEventListener("mousedown", (event) => event.preventDefault());

    button.addEventListener("click", () => {
      /** @param {string} label */
      const shown = (label) => {
        button.textContent = label;
        button.setAttribute("data-copied", "true");
        announce(label);
        setTimeout(() => {
          button.textContent = SELECTION_LABEL;
          button.removeAttribute("data-copied");
        }, 2000);
      };
      copyText(url).then(
        () => shown("Link copied"),
        () => shown("Copy failed"),
      );
    });

    // `selectionchange` fires on every character of a drag, so pointer drags update only on release.
    document.addEventListener("selectionchange", () => {
      if (!dragging) update();
    });
    document.addEventListener("pointerdown", () => {
      dragging = true;
    });
    document.addEventListener("pointerup", () => {
      dragging = false;
      update();
    });
  }

  // The page loads no third party until the reader asks: the link is the scriptless path and opens the service. A click in a new tab
  // or window stays a link.
  function embeds() {
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest(`${root} a.embed-link[data-embed-src]`) : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const src = embedPlayerUrl(link.dataset.embedSrc ?? "");
      if (!src) return;
      event.preventDefault();

      const frame = document.createElement("iframe");
      frame.src = src;
      frame.title = link.dataset.embedTitle ?? link.textContent ?? "";
      frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      link.replaceWith(frame);
      // Focus follows the activation, so a keyboard reader lands in the player rather than at the top of the page.
      frame.focus();
    });
  }

  readingProgress();
  scrollSpy();
  codeBlocks();
  headingLinks();
  embeds();
  onIdle(() => {
    footnotePreviews();
    lightbox();
    copyMarkdown();
    selectionLink();
  });
}
