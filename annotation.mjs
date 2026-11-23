/**
 * One GitHub workflow command. A crawled value can carry a newline, which would start a command of the page's own, so `%`, CR and LF
 * (and `:` and `,` in the title) are escaped as the runner reads them.
 * @param {string} level error, warning or notice @param {string} title @param {string} message
 */
export function annotation(level, title, message) {
  const data = (/** @type {string} */ text) =>
    text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  return `::${level} title=${data(title).replace(/:/g, "%3A").replace(/,/g, "%2C")}::${data(message)}`;
}
