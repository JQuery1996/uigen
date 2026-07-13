// Builds a self-contained HTML document that renders a generated component
// inside a sandboxed iframe — no remote bundler. The component's TSX is
// transpiled in-browser with Babel and rendered with React; Tailwind is loaded
// from the Play CDN. This is fast and has no cold-start dependency on any
// external build service.

/**
 * Turns the model's component source into runnable code:
 * - strips `import ... from "..."` lines (React is provided globally)
 * - rewrites the single `export default` into a known entry constant
 * - de-`export`s any other top-level declarations
 */
function sanitize(code: string): string {
  let c = code;
  // Rewrite lucide-react named imports to destructure from the global UMD export
  // (icons are provided in the preview as window.LucideReact). `as` → `:` so the
  // destructuring stays valid.
  c = c.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"](?:lucide-react|lucide)['"];?/g,
    (_m, names) => `const {${String(names).replace(/\bas\b/g, ":")}} = LucideReact;`
  );
  // Remove remaining import statements (single or multi-line) and bare imports.
  c = c.replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*$/gm, "");
  c = c.replace(/^\s*import\s+['"][^'"]+['"];?[ \t]*$/gm, "");
  // Rewrite the default export into a stable entry binding.
  c = c.replace(/\bexport\s+default\s+/g, "const __UIGEN_ENTRY__ = ");
  // Drop `export` from other top-level declarations so they stay in scope.
  c = c.replace(/\bexport\s+(const|let|var|function|class|async)\b/g, "$1");
  c = c.replace(/^\s*export\s*\{[^}]*\};?[ \t]*$/gm, "");
  return c.trim();
}

/**
 * Pulls every class-like token out of the source's string literals. The Tailwind
 * Play CDN generates styles by scanning the DOM, so utilities that only appear in
 * a not-yet-rendered tab/branch would be missing until that branch renders (and
 * can race the observer). Priming a hidden element with all tokens up front makes
 * every utility available immediately, so switching tabs never yields unstyled UI.
 */
function extractClassTokens(code: string): string {
  const strings = code.match(/"[^"]*"|'[^']*'|`[^`]*`/g) || [];
  const tokens = new Set<string>();
  for (const s of strings) {
    for (const t of s.slice(1, -1).split(/\s+/)) {
      if (t.length <= 60 && /[a-z]/.test(t) && /^[-a-zA-Z0-9:/[\]().#%!,]+$/.test(t)) {
        tokens.add(t);
      }
    }
  }
  return [...tokens].join(" ").replace(/</g, "");
}

export function buildPreviewDoc(code: string): string {
  // Escape only the sequence that could break out of the <script> container.
  const safe = sanitize(code).replace(/<\/script>/gi, "<\\/script>");
  const prime = extractClassTokens(code);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script>window.react = window.React;</script>
    <script crossorigin src="https://unpkg.com/lucide-react@0.451.0/dist/umd/lucide-react.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
    <style>
      html, body { margin: 0; min-height: 100%; }
      #__err {
        display: none;
        position: fixed; inset: 0; overflow: auto;
        margin: 0; padding: 16px;
        font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap; color: #b91c1c; background: #fef2f2;
      }
    </style>
  </head>
  <body class="bg-white text-slate-900">
    <!-- Primes Tailwind with every class used anywhere in the component so
         conditionally-rendered content (tabs, panels) is styled instantly. -->
    <div aria-hidden="true" style="position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden" class="${prime}"></div>
    <div id="root"></div>
    <pre id="__err"></pre>
    <script type="text/plain" id="__src">${safe}</script>
    <script>
      (function () {
        var errEl = document.getElementById("__err");
        function showError(e) {
          errEl.style.display = "block";
          errEl.textContent = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
        }
        window.addEventListener("error", function (ev) { showError(ev.error || ev.message); });
        window.addEventListener("unhandledrejection", function (ev) { showError(ev.reason); });

        // In-page anchor links (e.g. a navbar's #section links) don't scroll on
        // their own inside a sandboxed iframe — the default fragment navigation is
        // suppressed. Intercept the click and scroll to the target via JS so nav
        // links work. Runs in the capture phase so the component's own onClick
        // (e.g. closing a mobile menu) still fires.
        document.addEventListener("click", function (ev) {
          var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
          if (!a) return;
          var href = a.getAttribute("href") || "";
          if (href.length <= 1) { ev.preventDefault(); return; }
          var id = decodeURIComponent(href.slice(1));
          var target = null;
          try { target = document.getElementById(id) || document.querySelector('[name="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); } catch (e) {}
          if (target) {
            ev.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, true);

        try {
          if (!window.Babel) throw new Error("Preview failed to load (Babel unavailable — check your network).");
          var raw = document.getElementById("__src").textContent;
          // Bring every React hook (any use* export — useState, useId, useTransition,
          // useSyncExternalStore, …) plus common non-hook exports into scope, so the
          // component works no matter which hook it uses. Component/PureComponent are
          // intentionally excluded to avoid colliding with a component named "Component".
          var names = Object.keys(React).filter(function (k) { return /^use[A-Z]/.test(k); });
          ["Fragment", "createContext", "forwardRef", "memo", "createElement", "cloneElement", "isValidElement", "Children", "lazy", "Suspense", "startTransition"].forEach(function (k) {
            if (k in React) names.push(k);
          });
          var hooks = "const {" + names.join(",") + "} = React;\\n";
          var out = Babel.transform(hooks + raw, {
            filename: "component.tsx",
            presets: ["react", ["typescript", { isTSX: true, allExtensions: true }]],
          }).code;
          var factory = new Function(
            "React", "ReactDOM",
            out + "\\n;return typeof __UIGEN_ENTRY__ !== 'undefined' ? __UIGEN_ENTRY__ : null;"
          );
          var Comp = factory(window.React, window.ReactDOM);
          if (!Comp) throw new Error("No default-exported component was found in the generated code.");
          var root = ReactDOM.createRoot(document.getElementById("root"));
          root.render(React.createElement(React.StrictMode, null, React.createElement(Comp)));
        } catch (e) {
          showError(e);
        }
      })();
    </script>
  </body>
</html>`;
}
