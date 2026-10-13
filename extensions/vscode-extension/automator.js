"use strict";

// Compatibility entry for any local development tools that loaded automator.js.
module.exports = {
  ...require("@adme/automator-language"),
  ...require("@adme/automator-language/node-snippets")
};
