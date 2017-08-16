var page = require("webpage").create();

var states = require("./states").createStates(page);
var logging = require("./logging").logging(page);

page.settings.userAgent = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36";

// TODO: clean up resources with the release function.
// TODO: strip Google analytics to speed up the page.

states.run({transition: "inputLoginPageUrl"});
