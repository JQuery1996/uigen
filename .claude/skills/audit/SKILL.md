---
name: audit
description: Audit and update this project's vulnerable npm dependencies, then verify nothing broke. Dispatches the restricted dependency-auditor subagent to run npm audit, apply non-breaking npm audit fix, and verify with lint + build. Use whenever the user asks to audit dependencies, fix npm vulnerabilities, patch CVEs, or check for insecure packages.
disable-model-invocation: true
allowed-tools: Agent
---

# Audit npm dependencies

Don't run the audit yourself. Dispatch the **`dependency-auditor`** subagent to do
the whole job, then relay its summary to the user.

Why a subagent: the audit produces a lot of noise — full `npm audit` advisory
tables, the list of changed packages, and complete lint/build logs. Running it in a
separate context keeps that out of the main conversation; only the final report
comes back. The `dependency-auditor` agent is also deliberately restricted (Bash +
Read only, Sonnet 5) so a dependency update can't quietly turn into source edits.

## How to dispatch

Make **one** Agent call with `subagent_type: dependency-auditor` and the prompt
below verbatim. The agent enforces the safety guardrails itself, but pass the full
workflow so it runs the exact steps in order. Wait for it to finish, then present
its report. Don't add audit steps of your own.

---

**Subagent prompt:**

> Audit and update this project's vulnerable npm dependencies, then verify nothing
> broke. Work through the steps in order and stop early if a step fails rather than
> pushing changes on top of a broken state. Return only the Step 4 report as your
> final message.
>
> ## Step 1 — Find vulnerabilities
>
> Run `npm audit`. Summarize what it reports: for each advisory, note the package,
> the severity, and whether a fix is available. If there are zero vulnerabilities,
> say so and stop here — there's nothing to fix or verify.
>
> ## Step 2 — Apply non-breaking fixes
>
> Run `npm audit fix`. Report which packages changed.
>
> Do **not** run `npm audit fix --force` — it installs semver-major upgrades, the
> kind of change that silently breaks a build to close an advisory. If `npm audit`
> still reports vulnerabilities that only resolve via breaking changes, list them
> (package, severity, and the major version jump involved) and stop — they await
> the user's go-ahead.
>
> ## Step 3 — Verify nothing broke
>
> This project has **no test suite** (no `test` script is configured), so lint and
> build are the verification gate. Run both:
>
> - `npm run lint`
> - `npm run build`
>
> If a `test` script has since been added to `package.json`, run `npm test` too.
> If any of these fail, show the relevant output and stop — don't attempt further
> dependency changes to "fix" a build break introduced by the update; surface it so
> the user can decide.
>
> ## Step 4 — Report
>
> Give a short summary:
>
> - Vulnerabilities fixed (and the resulting count, e.g. "3 fixed, 0 remaining").
> - Anything left unfixed and why (e.g. "1 high — needs a breaking major upgrade, awaiting your go-ahead").
> - Whether verification passed (lint + build).
>
> Do not commit the changes.

---

## After the subagent returns

Relay the report to the user. Do not commit the changes unless the user explicitly
asks.
