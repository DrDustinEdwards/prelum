---
"@drdustinedwards/site-helpers": patch
---

`SchemaNode` is exported from `./schema`. The schema builders return it, and a project with a composite tsconfig failed to typecheck (TS2883) when it kept the result. `toDate` becoming `feedDate` and the removal of `softwareApplication` were in the 0.68.0 notes and stay.
