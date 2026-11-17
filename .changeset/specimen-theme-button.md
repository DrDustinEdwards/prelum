---
"@drdustinedwards/site-helpers": patch
---

Fix the specimen's theme button, which did nothing on every page: Capsomer's behavior imports this package by name, and the repository did not contain itself in node_modules, so the bundler left a bare `@drdustinedwards/site-helpers/text` import in /specimen.js and the whole script threw in the browser. The package is now linked to itself as a dev dependency, and the specimen build fails if a script it bundles still has a bare import.
