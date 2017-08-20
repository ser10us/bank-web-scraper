var args = require("system").args;

exports.createFsm = function (currentPage) {
    return new FSM(currentPage);
};

FSM = function (currentPage) {

    var RESOURCE_LOAD_DELAY = 1000;
    var START_TRANSITION_DELAY = 1000;
    var MAX_RESOURCE_LOAD_TIMEOUT = 10000;
    var MUTATION_DELAY = 100;

    var states = {};

    var transitionsExecutionHistory = [];

    var pendingTransition;

    /* Transition in progress means a transition that it is either delayed for further execution or already running. */
    var transitionInProgress;

    var pageStartLoadTime;

    var waitForResourcesToLoad;
    var waitForTransition;
    var onPageLoadFunc;
    var currentPageResources = {};

    var screenshots = args.join(",").toLowerCase().indexOf("screenshots=true") !== -1;

    var globalState = {};
    var currentFrameVisitState;

    var me = this;

    this.setGlobalStateValue = function (name, value) {
        globalState[name] = value;
    };

    this.getGlobalStateValue = function (name) {
        return globalState[name];
    };

    this.printGlobalState = function () {
        console.debug("Global state: " + JSON.stringify(globalState));
    };

    var setInProgress = function (transition) {
        if (transitionInProgress !== transition) {
            console.debug("Transition '" + transition + "' is in progress");
        }
        transitionInProgress = transition;
    };

    var unsetInProgress = function () {
        console.debug("Transition '" + transitionInProgress + "' finished (not in progress)");
        transitionInProgress = null;
    };

    var getInProgress = function () {
        return transitionInProgress;
    };

    var isTransitionRunning = function () {
        return !waitForTransition && transitionInProgress;
    };

    function injectJs() {
        if (!currentPage.evaluate(function () {
                return (typeof jQuery !== "undefined")
            })) {
            currentPage.injectJs("dep/jquery-2.1.4-min.js");
            currentPage.evaluate(function () {
                window.$CRSQ = jQuery.noConflict();
                console.debug("Scraper's jQuery loaded");
            });
        } else {
            currentPage.evaluate(function () {
                console.debug("Provided jQuery: " + jQuery.fn.jquery);
                // Temporarily save the original jQuery reference:
                window.$$$___jQueryOriginal = jQuery;
            });
            currentPage.injectJs("dep/jquery-2.1.4-min.js");
            currentPage.evaluate(function () {
                window.$CRSQ = jQuery.noConflict();

                // $ keeps pointing to the provided jQuery version:
                window.jQuery = window.$$$___jQueryOriginal;
                window.$$$___jQueryOriginal = undefined;

                console.debug("Provided jQuery after scraper's jQuery has been loaded: " + jQuery.fn.jquery);
            });
        }

        currentPage.evaluate(function () {
            console.debug("Scraper's jQuery: " + $CRSQ.fn.jquery);
        });

        if (currentPage.evaluate(function () {
                return typeof fjs != "undefined";
            })) {
            console.warn("Functional.js already provided");
        } else {
            currentPage.injectJs("dep/functional-0.6.15-min.js");
        }

        currentPage.injectJs("lookup.js");
    }

    function onError(e, trace) {
        var msgStack = ["'" + e + "'"];
        if (trace && trace.length) {
            msgStack.push("\nTRACE:");
            trace.forEach(function (t) {
                msgStack.push(" -> " + ((t.file || t.sourceURL) || "unknown file") + ": " + t.line + (t.function ? " (in function " + t.function + ")" : ""));
            });
            msgStack.push(""); // empty line
        }

        console.error("UNKNOWN ERROR: " + msgStack.join("\n"));

        if (currentPage.url) {
            console.info("Run exit transition");
            runExitTransition();
        } else {
            // State machine failed, no further transitions possible:
            phantom.exit(1);
        }
    }

    // TODO: which one is called?
    currentPage.onError = function (msg, trace) {
        onError(msg, trace);
    };

    phantom.onError = function (msg, trace) {
        onError(msg, trace);
    };

    var unsetTimeout = function (t, name) {
        if (t) {
            if (!t) {
                console.warn("Timeout '" + name + "' is not set");
            }
            console.debug("Clear '" + name + "' timeout");
            clearTimeout(t);
        }
    };

    var isTransitionLockAcquired = function () {
        return isTransitionRunning() || isPendingPageContextTransition();
    };

    var onPageResourcesLoaded = function () {
        if (!onPageLoadFunc) {
            console.debug("Page onLoad is not set, resuming a pending transition...");
            resumePendingTransition();
        } else {
            console.info("All resources loaded -> running a pending transition...");

            currentPageResources = {};

            onPageLoadFunc();
            onPageLoadFunc = null;
        }
    };

    var getPendingURLs = function () {
        return Object.keys(currentPageResources);
    };

    currentPage.onResourceRequested = function (resource, networkRequest) {
        var url = resource.url;

        console.debug("Resource requested: " + url);

        if (isTransitionLockAcquired()) {
            console.warn("A resource " + url + " is being loaded while transition '" + getInProgress() + "' is in progress");
        } else {
            var timeout = setTimeout(function () {
                console.warn("Resource " + url + " takes more than " + MAX_RESOURCE_LOAD_TIMEOUT + " ms to load (started during '" + currentPageResources[url].startedDuring + "')");

                delete currentPageResources[url];

                if (Object.keys(currentPageResources).length === 0) {
                    // Run when all timeouts are elapsed:
                    onPageResourcesLoaded();
                }
            }, MAX_RESOURCE_LOAD_TIMEOUT);

            unsetTimeout(waitForTransition, "wait for transition");
            unsetTimeout(waitForResourcesToLoad, "wait for resource");
        }

        currentPageResources[url] = {
            startTime: Date.now(),
            timeout: timeout,
            startedDuring: getInProgress()
        };
    };

    currentPage.onResourceReceived = function (response) {
        var url = response.url;
        var timeTaken = Date.now() - currentPageResources[url].startTime;

        console.debug("Resource received in " + timeTaken + " ms: " + url);

        clearTimeout(currentPageResources[url].timeout);

        delete currentPageResources[url];

        if (isTransitionLockAcquired()) {
            console.warn("A resource " + url + " has been received while transition '" + getInProgress() + "' is in progress");
            return;
        }

        unsetTimeout(waitForTransition, "wait for transition");
        unsetTimeout(waitForResourcesToLoad, "wait for resource");

        var pendingUrls = getPendingURLs();
        if (pendingUrls.length !== 0) {
            console.debug("Pending URLs:\n\n" + pendingUrls.join("\n") + "\n");
        }

        // At the moment all requested resources have been loaded:
        if (pendingUrls.length === 0) {
            console.debug("Set 'wait for resource' timeout (" + RESOURCE_LOAD_DELAY + "ms)");

            waitForResourcesToLoad = setTimeout(function () {
                onPageResourcesLoaded();
            }, RESOURCE_LOAD_DELAY);

            console.debug("Waiting for other resources to load...");
        }

        if (response.contentType && response.contentType.indexOf("comma") !== -1) {
            if (response.stage === "end") {
                // Not supported by PhantomJs yet.
            }
        }
    };

    currentPage.onFilePicker = function (oldFile) {
        // Not supported by PhantomJs yet.
        console.debug("On file picker");
        return "";
    };

    currentPage.onUrlChanged = function (targetUrl) {
        console.debug("New URL: " + targetUrl);
    };

    currentPage.onLoadStarted = function () {
        pageStartLoadTime = Date.now();
        console.debug("Page load started");
    };

    currentPage.onLoadFinished = function () {
        logging.enableInPageContext(currentPage);

        console.info("Page load finished");

        onPageLoadFunc = function () {
            console.debug("Loading time " + (Date.now() - pageStartLoadTime) + " ms");
            pageStartLoadTime = null;

            console.info("Loaded page title: " + currentPage.evaluate(function () {
                return document.title;
            }));

            console.debug("Loaded page URL: " + currentPage.evaluate(function () {
                return document.URL;
            }));

            var visitFrames = function (parentPath, acc) {
                var count = currentPage.framesCount;
                for (var i = 0; i < count; i++) {
                    currentPage.switchToFrame(i);
                    var currentPath = parentPath.concat([i]);
                    acc.push(currentPath);
                    acc = visitFrames(currentPath, acc);
                }

                currentPage.switchToParentFrame();

                return acc;
            };

            currentFrameVisitState = visitFrames([], []);

            console.debug("Frames metadata: " + JSON.stringify(currentFrameVisitState));

            console.debug("Injecting JavaScript...");
            injectJs();
            console.debug("JavaScript injected");

            console.debug("Resume the next transition on page load");

            resumePendingTransition();
        };
    };

    currentPage.onInitialized = function () {
        console.debug("Page initialized");
        console.debug("User-agent: " + currentPage.settings.userAgent);
    };

    currentPage.onNavigationRequested = function (url, type, willNavigate, main) {
        console.debug("Trying to navigate to " + url + " (caused by " + type + ")");
        if (!willNavigate) {
            console.warn("Navigation blocked");
        }
    };

    currentPage.onUrlChanged = function (targetUrl) {
        console.debug("New URL: " + targetUrl);
    };

    currentPage.onPageCreated = function (newPage) {
        console.warn("A pop-up window is opened");
    };

    this.getTransitionsExecutionHistory = function () {
        return transitionsExecutionHistory.slice();
    };

    var addToExecutionHistory = function (name) {
        transitionsExecutionHistory.push(name);
    };

    var runExitTransition = function () {
        transition({transition: "exit"});
    };

    var getPriorTransitionName = function () {
        return transitionsExecutionHistory[transitionsExecutionHistory.length - 1];
    };

    this.addState = function (name, state) {
        if (states[name]) {
            console.warn("State " + name + "has been overridden");
        }
        state.name = name;
        states[name] = state;
    };

    var getStateByName = function (name) {
        return states[name];
    };

    this.run = function (transitionData) {
        transition(transitionData);
    };

    var evaluateStateInPageContext = function (f, params, afterTransition) {
        var setPhantomCallback = function () {
            currentPage.evaluate(function () {
                window.callPhantom = function (p) {
                    prompt("var transitionParam = " + JSON.stringify(p) + ";");
                };
            });
        };

        // Workaround: onCallback doesn't seem to work for frames.
        currentPage.onPrompt = function (param) {
            eval(param); // evaluates the 'transitionParam' variable

            if (transitionParam.command === "nextTransition") {
                console.debug("'nextTransition' call");

                var currentTransition = getInProgress();
                if (!isReadOnlyTransition(currentTransition)) {
                    makeScreenshot("after-" + currentTransition);
                }

                if (transitionParam.transition !== "current") {
                    afterTransition(transitionParam.transition);
                } else {
                    var switchToFrameByPath = function (path) {
                        currentPage.switchToMainFrame();
                        while (path.length) {
                            currentPage.switchToFrame(path.pop());
                        }
                    };

                    var getNextFramePath = function () {
                        if (!currentFrameVisitState.length) {
                            return null;
                        }
                        return currentFrameVisitState.pop();
                    };

                    var nextFramePath = getNextFramePath();
                    if (!nextFramePath) {
                        throw "No frames found. Giving up...";
                    }

                    console.info("Switching to the frame '" + nextFramePath + "'...");
                    switchToFrameByPath(nextFramePath);

                    setPhantomCallback();

                    logging.enableInPageContext(currentPage);

                    injectJs();

                    console.info("Retrying with the transition '" + currentTransition + "'...");
                    afterTransition({transition: currentTransition});
                }
            } else if (transitionParam.command === "setGlobalState") {
                console.debug("'setGlobalState' call");

                if (typeof transitionParam.value === "object") {
                    me.setGlobalStateValue(transitionParam.name, transitionParam.value);
                } else {
                    eval("var globalStateValue = " + transitionParam.value + ";");
                    me.setGlobalStateValue(transitionParam.name, globalStateValue);
                }
            } else {
                console.warn("Unknown onPrompt parameter: " + JSON.stringify(param));
            }
        };

        setPhantomCallback();

        currentPage.evaluate(function () {
            window.fsm = {
                setGlobalStateValue: function (name, value) {
                    callPhantom({
                        command: "setGlobalState",
                        name: name,
                        value: value
                    });
                }
            }
        });

        makeScreenshot("before-" + getInProgress());

        var stateParameters = {};
        if (params) {
            // A state can pass a parameter to the next state:
            stateParameters.params = params;
        }

        stateParameters["_globalState"] = globalState;

        var nextCommand = currentPage.evaluate(function (f, stateParameters, MUTATION_DELAY) {
            var numOfMutations = 0;
            var transitionFunc = function () {
                if (numOfMutations) {
                    console.debug(numOfMutations + " DOM mutation" + (numOfMutations === 1 ? "" : "s") + " executed");
                }

                window.domMutationObserver.disconnect();
                console.debug("Mutation observer disconnected");

                console.debug("Running the state handler... ");

                window.fsm.getGlobalStateValue = function (name) {
                    return stateParameters["_globalState"][name];
                };

                try {
                    console.debug("Running the page context function...");
                    // TODO: check the number of elements (e.g. < 15 (needs to be clarified) --> go to the next frame).
                    callPhantom({
                        command: "nextTransition",
                        transition: f(window.$CRSQ, stateParameters)
                    });
                } catch (e) {
                    if (typeof e === "object" && e.checked) {
                        console.warn("EXCEPTION: " + e.msg);

                        // Try to run the transition again after switching to the other frame:
                        callPhantom({
                            command: "nextTransition",
                            transition: "current"
                        });
                        return;
                    }

                    console.error("UNKNOWN ERROR (page context): '" + e + "'");

                    callPhantom({
                        command: "nextTransition",
                        transition: "exit"
                    });
                }

                numOfMutations = 0;
            };

            var delay;
            window.domMutationObserver = new WebKitMutationObserver(function (mutations) {
                if (delay) {
                    console.debug("Clear DOM mutation timeout");
                    clearTimeout(delay);
                    delay = null;
                }

                numOfMutations++;

                console.debug("DOM mutations are being executed (wait for " + MUTATION_DELAY + " ms)...");
                delay = setTimeout(transitionFunc, MUTATION_DELAY);
            });

            if (!window.$CRSQ) {
                console.error("jQuery is not set");
                throw "jQuery not found";
            }

            window.$CRSQ(document).ready(function () {
                console.debug("jQuery DOM ready event");

                window.domMutationObserver.observe(document.body, {
                    attributes: true,
                    childList: true,
                    characterData: true,
                    subtree: true
                });
                console.debug("Mutation observer is set");

                console.debug("Wait for DOM mutations for " + MUTATION_DELAY + " ms");
                delay = setTimeout(transitionFunc, MUTATION_DELAY);
            });
        }, f, stateParameters, MUTATION_DELAY);
    };

    var setPendingTransition = function (s) {
        pendingTransition = s;
    };

    // TODO: typeof
    var isPendingTransitionSet = function () {
        return !!(pendingTransition && pendingTransition.transition);
    };

    // TODO: typeof
    var isPendingPageContextTransition = function () {
        return !!(pendingTransition && states[pendingTransition.transition].f);
    };

    var isReadOnlyTransition = function (name) {
        return !!(states[name].isReadOnly || states[name].isUserInput);
    };

    var isUserInputTransition = function (name) {
        return !!(states[name].isUserInput);
    };

    var getAndResetPendingTransition = function () {
        var s = pendingTransition;
        pendingTransition = null;
        return s;
    };

    var makeScreenshot = function (stateName) {
        if (!screenshots || !currentPage.url || isUserInputTransition(getInProgress())) {
            return;
        }

        var screenshotName = "state-" + stateName + "-" + new Date().getTime() + ".png";
        console.debug("Making a screenshot " + screenshotName + "...");

        currentPage.render(screenshotName);
    };

    var resumePendingTransition = function () {
        if (!isPendingTransitionSet()) {
            console.error("There is no transition pending");
            runExitTransition();
            return;
        }

        var pending = getAndResetPendingTransition();

        console.debug("Resume pending transition '" + pending.transition + "'");

        transition(pending);
    };

    var transition = function (transitionData) {
        if (!transitionData || !transitionData.transition) {
            throw "Null transition";
        }

        var stateName = transitionData.transition;
        if (getInProgress() && getInProgress() !== stateName) {
            throw "There is an another transition in progress (" + getInProgress() + ")";
        }

        var state = getStateByName(stateName);
        if (!state) {
            // FIXME: is not caught.
            throw "State '" + stateName + "' not found";
        }

        if (state.f && state.fInPageContext) {
            throw "More than one handler for a state not allowed";
        }

        setInProgress(stateName);

        if (waitForTransition) {
            // After timeout has been elapsed:
            waitForTransition = null;
        } else {
            var isJQueryFound = currentPage.evaluate(function () {
                return !!(window.$CRSQ)
            });
            if (!getPriorTransitionName() || state.f || states[getPriorTransitionName()].isReadOnly || (states[getPriorTransitionName()].f && isJQueryFound)) {
                var timeout = Math.round(START_TRANSITION_DELAY / 10); // minimal delay
                console.debug("Run transition immediately");
            } else {
                // If jQuery is not yet loaded take some time until resources loading takes effect:
                var timeout = START_TRANSITION_DELAY;
            }

            if (timeout !== 0) {
                console.debug("Set transition timeout " + timeout + " ms");
            }

            var startTransitionFunc = function () {
                if (timeout !== 0) {
                    console.debug("Wait for transition timeout elapsed (" + timeout + " ms), running the transition...");
                }

                var numberOfPendingResources = getPendingURLs().length;
                if (numberOfPendingResources === 0) {
                    transition(transitionData);
                } else {
                    var many = numberOfPendingResources !== 1;
                    console.warn("There " + (many ? "are" : "is") + " " + numberOfPendingResources + " resource" + (many ? "s" : "") + " still being loaded, set a new transition timeout");
                    waitForTransition = setTimeout(startTransitionFunc, timeout);
                }
            };

            waitForTransition = setTimeout(startTransitionFunc, timeout);

            addToExecutionHistory(stateName);
            setPendingTransition(transitionData);

            if (timeout !== 0) {
                console.debug("Transition '" + stateName + "' is pending");
            }

            return;
        }

        console.info("Running transition '" + stateName + "'...");

        var start = Date.now();
        if (state.f) {
            var nextTransitionData = state.f(transitionData.params);

            unsetInProgress();

            console.debug("Transition '" + stateName + "' took " + (Date.now() - start) + " ms");

            transition(nextTransitionData);
        } else if (state.fInPageContext) {
            console.debug("Evaluate transition '" + stateName + "' in the page context");

            evaluateStateInPageContext(state.fInPageContext, transitionData.params, function (nextTransitionData) {
                console.debug("Page context transition '" + stateName + "' took " + (Date.now() - start) + " ms");

                unsetInProgress();

                transition(nextTransitionData);
            });
        } else {
            throw "No state function defined for '" + stateName + "'";
        }
    };
};
