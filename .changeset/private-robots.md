---
"@drdustinedwards/site-helpers": minor
---

`privateRobotsResponse()` (`./robots`) is /robots.txt for a host no crawler should fetch from, such as an MCP door or an admin API: `User-agent: *` / `Disallow: /` (`DISALLOW_ALL`, the same text a preview copy gets), plain text, `X-Robots-Tag: noindex`. It needs no origin and carries none of the public policy's bot lists, so a door's Worker grows by a few hundred bytes where `robotsResponse({ preview: true })` added about a kilobyte.
