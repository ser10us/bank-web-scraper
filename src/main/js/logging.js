var args = require("system").args;

exports.logging = function () {
    return new Logging();
};

Logging = function () {

    var DEBUG = "debug";
    var INFO = "info";
    var WARN = "warn";
    var ERROR = "error";
    var DATA = "data";

    var supportedLogLevels = [DEBUG, INFO, WARN, ERROR];
    var splitByLevelRegExp = "^" + supportedLogLevels.concat([DATA]).join("|").toUpperCase();

    var formatMessage = function (msg) {
        var getTime = function () {
            var leadingZeros = function (num) {
                if (num < 10) {
                    return "0" + num;
                }
                return num;
            };
            var currentDate = new Date();
            return leadingZeros(currentDate.getHours()) + ":" + leadingZeros(currentDate.getMinutes()) + ":" + leadingZeros(currentDate.getSeconds());
        };

        var format = function (logLevel, msg) {
            var withDate = logLevel + "\t[" + getTime() + "]" + msg;
            return withDate.replace(/\n/g, "\n\t");
        };

        var match = msg.match(splitByLevelRegExp);
        if (match) {
            return format(match[0], msg.substr(match[0].length));
        }
        // Unknown message (alert?):
        var prettyPrinted = msg;
        var msgType = typeof msg;
        if (typeof msg == "object") {
            prettyPrinted = JSON.stringify(msg);
        }
        return format("SYSTEM", ":\t[" + msgType + "] " + prettyPrinted);
    };

    console.logWithNoCaretReturn = function (msg) {
        require("system").stdout.write(msg);
    };

    var logLevelMatch = (args.join(";").toLowerCase() + ";").match("loglevel=(" + supportedLogLevels.join("|") + ");");
    if (logLevelMatch) {
        var logLevel = logLevelMatch[1];
    } else {
        var logLevel = INFO;
    }

    var selectedLogLevels = supportedLogLevels.slice(supportedLogLevels.indexOf(logLevel));
    var notSelectedLogLevels = supportedLogLevels.slice(0, supportedLogLevels.indexOf(logLevel));

    var logFunctions = {};

    logFunctions[DEBUG] = function (msg) {
        console.log(formatMessage(DEBUG.toUpperCase() + ":\t" + msg));
    };

    logFunctions[INFO] = function (msg) {
        console.log(formatMessage(INFO.toUpperCase() + ":\t" + msg));
    };

    logFunctions[WARN] = function (msg) {
        console.log(formatMessage(WARN.toUpperCase() + ":\t" + msg));
    };

    logFunctions[ERROR] = function (msg) {
        require("system").stderr.writeLine(formatMessage(ERROR.toUpperCase() + ":\t" + msg));
    };

    selectedLogLevels.forEach(function (level) {
        console[level] = logFunctions[level];
    });

    notSelectedLogLevels.forEach(function (level) {
        console[level] = function () {

        };
    });

    console.log(formatMessage("Selected log levels: " + selectedLogLevels));

    this.enableInPageContext = function (currentPage) {
        currentPage.onConsoleMessage = function (msg) {
            // TODO: ignore site prompts! Add an additional check.
            if (msg.indexOf("prompt") !== -1) {
                currentPage.onPrompt(msg); // PhantomJS workaround for frames
            } else {
                console.log(formatMessage(msg));
            }
        };

        currentPage.evaluate(function (selectedLogLevels, notSelectedLogLevels, constants) {
            var logFunctions = {};

            logFunctions[constants.DEBUG] = function (msg) {
                console.log(constants.DEBUG.toUpperCase() + ":\t" + msg);
            };

            logFunctions[constants.INFO] = function (msg) {
                console.log(constants.INFO.toUpperCase() + ":\t" + msg);
            };

            logFunctions[constants.WARN] = function (msg) {
                console.log(constants.WARN.toUpperCase() + ":\t" + msg);
            };

            logFunctions[constants.ERROR] = function (msg) {
                console.log(constants.ERROR.toUpperCase() + ":\t" + msg);
            };

            // It seems like PhantomJS is not able to serialize clojures:
            selectedLogLevels.forEach(function (level) {
                window.console[level] = logFunctions[level];
            });

            notSelectedLogLevels.forEach(function (level) {
                console[level] = function () {
                };
            });

            window.console[constants.DATA] = function (msg, data) {
                console.log(constants.DATA.toUpperCase() + ":\t\n\n*** " + msg + " ***\n" + data + "\n");
            };
        }, selectedLogLevels, notSelectedLogLevels, {DEBUG: DEBUG, INFO: INFO, WARN: WARN, ERROR: ERROR, DATA: DATA});

        console.debug("Logging has been enabled");
    };
};
