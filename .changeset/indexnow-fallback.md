---
"@drdustinedwards/site-helpers": patch
---

`submitIndexNow` tries the next IndexNow engine (Bing, then Yandex) when api.indexnow.org answers 429, a 5xx or fails, since Cloudflare Workers' shared egress is sometimes rate limited there. Any other answer, such as a refused key, is final.
