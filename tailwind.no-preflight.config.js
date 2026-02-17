/**
 * Tailwind config variant with preflight (CSS reset) disabled.
 * Used to build styles-no-preflight.css for apps that have their own CSS reset (e.g. MUI).
 *
 * @type {import('tailwindcss').Config}
 */
const baseConfig = require("./tailwind.config.js");

module.exports = {
  ...baseConfig,
  corePlugins: {
    preflight: false,
  },
};
