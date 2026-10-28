// The specimen's one script: wires Capsomer's letterhead and its theme button. specimen/build.mjs bundles it into /specimen.js,
// so the page needs no inline script.
import { enhance as enhanceHeader } from "capsomer/behavior/site-header";
import { enhance as enhanceTheme } from "capsomer/behavior/theme-switch";

enhanceHeader();
enhanceTheme();
