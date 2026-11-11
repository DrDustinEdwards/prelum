// Its own module so the directive plugins and the renderer throw the one class without importing each other.

export class ContentError extends Error {
  /**
   * @param {string} file
   * @param {string} message
   */
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.name = "ContentError";
    this.file = file;
  }
}

// The message of a thrown value: site-runtime ./log's, the one every package and site uses.
export { errorMessage } from "@dustinedwards/site-runtime/log";
