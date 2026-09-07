# Internationalization & RTL

English and Persian (Farsi) are both supported from V1, switchable at
runtime with no page reload, persisted in `localStorage`, defaulting to
English.

## Translation files

```
apps/web/src/i18n/locales/
  en/  common.json  navigation.json  complaints.json  validation.json
  fa/  common.json  navigation.json  complaints.json  validation.json
```

Four namespaces keep concerns separated: `common` (app-wide chrome, actions,
staff roles), `navigation` (side nav, breadcrumbs), `complaints` (everything
specific to the case-management module — status/priority/category/source
labels, form fields, timeline event templates), `validation` (form error
messages). A future module adds its own namespace file
(`locales/en/packing.json`, etc.) rather than growing `complaints.json`.

**Every user-visible string goes through `t()`.** There are no hardcoded
English strings in components — grep for `useTranslation` usage across
`apps/web/src` to see the pattern; a new component that renders text without
importing `useTranslation` is the one thing to flag in review.

`apps/web/src/i18n/i18n.ts` configures `react-i18next` with
`i18next-browser-languagedetector` (order: `localStorage` → `navigator`,
cached to `localStorage` under `complaint-system.language`) and
`load: "languageOnly"`.

### Why `normalizeLanguage` / `useActiveLanguage` exist

Even with `load: "languageOnly"` configured, browser language detection can
still surface a regional variant (`en-GB`, `fa-IR`) as `i18n.language` in
some environments. An exact-match lookup against that — a translation key,
`RTL_LANGUAGES.includes(...)` — silently fails or (worse) silently leaves a
Persian-region user on an LTR layout. Every read of the active language goes
through `i18n/useActiveLanguage.ts` (a hook wrapping
`i18n/i18n.ts#normalizeLanguage`), which reduces any locale string to `"en"`
or `"fa"`, instead of components casting `i18n.language` directly.

## RTL architecture

Selecting Persian does four things simultaneously (`App.tsx`):

1. `document.documentElement.dir = "rtl"` and `lang = "fa"`.
2. `createAppTheme("fa")` builds an MUI theme with `direction: "rtl"` and a
   Persian-capable font stack (`Vazirmatn`, loaded via Google Fonts in
   `index.html`, falling back to system fonts).
3. `theme/rtlCache.ts#getEmotionCache("rtl")` swaps in an emotion cache
   configured with `stylis-plugin-rtl`, so every MUI `sx`/`styled` rule is
   transformed to its RTL-mirrored equivalent automatically — this is what
   flips padding/margin/flex direction across the entire component tree
   without per-component RTL logic.
4. React Router, MUI `Drawer`/`Table`/`Dialog`/`Breadcrumbs`/`Pagination`,
   and this app's own layout all mirror for free because they're built on
   plain flexbox + MUI's direction-aware components — none of them hardcode
   `left`/`right`.

**Logical CSS properties only.** The codebase avoids `margin-left`,
`padding-right`, etc. — MUI's `sx` shorthand and `useFlexGap` already emit
logical properties (`marginInlineStart`, etc.) under the hood, and no
component in this codebase overrides that with a physical-direction style.

### Identifiers must not visually reorder

A phone number like `+98 912 000 1122` or a case number like
`C-20260903-0001` contains digits and symbols but no strong-direction
characters, so when it's embedded in Persian text, the browser's bidi
algorithm can visually reorder it (e.g. render the phone number
back-to-front) even though the *stored* string is completely untouched.
`components/Ltr.tsx` wraps any identifier-bearing text (`dir="ltr"` +
`unicode-bidi: isolate`) to force correct left-to-right rendering regardless
of the surrounding paragraph direction. It's applied everywhere an
identifier is rendered: case numbers, order numbers, SKUs, phone numbers,
emails (see `CaseHeader`, `CaseTable`, `CaseInfoPanel`, `CustomerSummaryBar`,
`CaseDetailPage`'s breadcrumb).

## Date / time / number / currency formatting

`apps/web/src/utils/localeFormat.ts` centralizes all locale-aware formatting
via the `Intl` API:

- `formatDate` / `formatDateTime` / `formatTime` — `Intl.DateTimeFormat`.
  For `fa`, this resolves to the `fa-IR` locale, which browsers render using
  the Persian (Jalali) calendar and Persian numerals — the idiomatic
  presentation for Persian users, not just a translated Gregorian date.
- `formatRelativeTime` — `Intl.RelativeTimeFormat` ("21 minutes ago" / "۲۱
  دقیقه پیش").
- `formatNumber` — `Intl.NumberFormat`.
- `formatCurrency` — `Intl.NumberFormat` with `style: "currency"`.

**These utilities are never used on identifiers.** Case numbers, SKUs, order
numbers, and phone numbers are rendered as plain stored strings (wrapped in
`Ltr`, see above) — never passed through `formatNumber` or similar, which
would corrupt them (e.g. `formatNumber` on `fa` renders Persian digits, which
would make a SKU unsearchable/unusable against Shopfa).

## Adding a third language

1. Add the language code to `SUPPORTED_LANGUAGES` in `i18n/i18n.ts`, and to
   `RTL_LANGUAGES` if it's right-to-left.
2. Add `locales/<code>/{common,navigation,complaints,validation}.json` with
   the same keys as `en/`.
3. Add a font stack entry in `theme/createAppTheme.ts#FONT_STACKS` if the
   default stack doesn't cover the script.
4. Add a label in `common.json#language.<code>` for the switcher.

No other code changes are required — the theme, RTL cache, and formatting
utilities are already driven by `SUPPORTED_LANGUAGES`/`RTL_LANGUAGES`.
