---
"@drdustinedwards/site-helpers": minor
---

The types are the JSDoc in each module, and the declarations are generated into `dist/` on release instead of kept by hand in `*.d.mts` files. A few types differ slightly from the old hand-written ones (optional properties read `T | undefined`, some constants are literal types, interfaces are type aliases).
