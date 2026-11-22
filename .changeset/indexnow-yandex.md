---
"@drdustinedwards/site-helpers": patch
---

`submitIndexNow` tries Yandex and Seznam before api.indexnow.org, because Cloudflare Workers get 429 from api.indexnow.org and Bing and 202 from Yandex. Any engine shares the submission with the rest.
