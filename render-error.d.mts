/**
 * The message of a thrown value: an Error's own message, anything else as a string.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error: unknown): string;
export class ContentError extends Error {
    /**
     * @param {string} file
     * @param {string} message
     */
    constructor(file: string, message: string);
    file: string;
}
