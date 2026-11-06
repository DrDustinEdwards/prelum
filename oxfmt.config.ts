import { defineConfig } from "oxfmt";
import { format } from "@dustinedwards/devkit/oxfmt";

export default defineConfig({
  ...format,
  // Byte-exact inputs and outputs of the golden render tests and the specimen build.
  ignorePatterns: [
    ...(format.ignorePatterns ?? []),
    "test/fixtures/",
    "specimen/expected/",
    "specimen/elements/",
    "specimen/diagrams/",
  ],
});
