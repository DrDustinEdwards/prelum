---
"@drdustinedwards/site-helpers": minor
---

JSON-LD in `<head>` is written by site-runtime's `scriptJson` (`@dustinedwards/site-runtime/html`). `jsonLdText` is removed from `@drdustinedwards/site-helpers/xml`: import `scriptJson` from `@dustinedwards/site-runtime/html` instead (same output, `&`, `<`, `>`, U+2028 and U+2029 escaped). Capsomer's `JsonLd` already does, from Capsomer 0.155.0.
