export { errorMessage } from "@dustinedwards/site-runtime/log";
export class ContentError extends Error {
  /**
   * @param {string} file
   * @param {string} message
   */
  constructor(file: string, message: string);
  file: string;
}
