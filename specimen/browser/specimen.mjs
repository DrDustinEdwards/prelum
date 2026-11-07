// The specimen's one script: wires Capsomer's letterhead and its theme button, and enhances the :::chart figures (Enarratio's
// redrawCharts: its keyboard walk, tooltips and legend filters, and a redraw to the frame's width). specimen/build.mjs
// bundles it into /specimen.js, so the page needs no inline script.
import { enhance as enhanceHeader } from "capsomer/behavior/site-header";
import { enhance as enhanceTheme } from "capsomer/behavior/theme-switch";

import { redrawCharts } from "enarratio/redraw";

enhanceHeader();
enhanceTheme();
redrawCharts();
