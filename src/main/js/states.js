exports.createStates = function (currentPage) {
    var fsm = require("./fsm").createFsm(currentPage);

    fsm.addState("inputLoginPageUrl", {
        f: function () {
            console.logWithNoCaretReturn("\n\tPlease enter a URL for the banking login page:\t");
            var url = require("system").stdin.readLine();
            fsm.setGlobalStateValue("url", url);

            console.log("");

            console.info("Page URL: " + url);

            return {transition: "indexPage"};
        }
    });

    fsm.addState("indexPage", {
        f: function () {
            currentPage.open(fsm.getGlobalStateValue("url"), function (status) {
                if (status === "fail") {
                    console.error("Page load failed");
                }
            });
            return {transition: "findLoginForm"};
        }
    });

    fsm.addState("findLoginForm", {
        fInPageContext: function ($) {
            if ($("body").findPassword().isEmpty()) {
                console.warn("Password input not found");

                // Trying to find a button that opens a login form dynamically:
                var loginButtons = $.findClickableByRegExp(/Log(\s|-)?in|einloggen|anmelden|mein(em)?\sKonto/i);
                if (loginButtons.isEmpty()) {
                    console.warn("Login button not found");

                    // Is it a mobile version of the site?
                    $.findClickableByRegExp(/klassische\w?\s\w*Site/i)
                        .orElse(function () {
                            throw {
                                checked: true,
                                msg: "Login page not found"
                            }
                        })
                        .orMoreThanOne(function () {
                            console.warn("Found more than one login page link")
                        })
                        .first()
                        .print("Login page link: ")
                        .sendClickEvent();

                    return {transition: "findLoginForm"};
                }

                loginButtons
                    .orMoreThanOne(function () {
                        console.warn("Found more than one login button")
                    })
                    .first()
                    .print("Login: ")
                    .sendClickEvent();

                return {transition: "findLoginForm"};
            }

            fsm.setGlobalStateValue("labels", $.findLoginInputs().print("Login input: ").label());
            fsm.setGlobalStateValue("pageText", $("body").visibleTexts());

            return {transition: "inputCredentials"};
        }
    });

    fsm.addState("inputCredentials", {
        f: function () {
            console.log("\n\tPlease enter credentials:\n");

            var labels = fsm.getGlobalStateValue("labels");
            console.debug("Labels: " + labels);

            if (typeof labels !== "string") {
                var labelArray = labels;
            } else {
                var labelArray = [labels];
                console.warn("There is only one control being set (" + labels + ")")
            }

            var credentials = labelArray
                .map(function (label) {
                    console.logWithNoCaretReturn("\t" + label + ": ");
                    return {label: label, value: require("system").stdin.readLine()};
                })
                .reduce(function (map, obj) {
                    map[obj.label] = obj.value;
                    return map;
                }, {});
            fsm.setGlobalStateValue("credentials", credentials);

            console.log("");

            return {transition: "login"};
        }
    });

    fsm.addState("login", {
        fInPageContext: function ($) {
            var loginInputs = $.findLoginInputs();

            loginInputs
                .print("Login input: ")
                .each(function () {
                    var label = $(this).label();
                    if (!fsm.getGlobalStateValue("credentials")[label]) {
                        console.warn("Field '" + label + "' is not set");
                    }
                    console.info("Setting value '" + fsm.getGlobalStateValue("credentials")[label] + "' for '" + label + "'...");
                    $(this).typeText(fsm.getGlobalStateValue("credentials")[label]);
                });

            var allSubmitControls = $.findClickableByRegExp(/Log(\s|-)?(in|on)|einloggen|anmelden|weiter|senden|starten/i)
                .orElse(function () {
                    console.warn("Submit control not found")
                })
                .orMoreThanOne(function () {
                    console.warn("Found more than one submit control")
                })
                .sortSubmitFirst();

            var currentForm = loginInputs.closest("form");
            var submitsForTheCurrentForm = allSubmitControls
                .filter(function () {
                    // Compare forms as DOM-nodes:
                    return currentForm.get(0) === $(this).closest("form").get(0);
                });
            var submits;
            if (submitsForTheCurrentForm.isNotEmpty()) {
                submits = submitsForTheCurrentForm;
            } else {
                submits = allSubmitControls;
                console.warn("Submit control doesn't belong to the current form");
            }

            var transactionsAreaOption = currentForm
                .closest("body")
                .find("select:visibleExt option")
                .filter(function () {
                    return match($(this).text())(/Ums\u00e4tze|Umsatz/i)
                })
                .filter(function () {
                    return $(this).text().indexOf("Depot") === -1
                })
                .print("Transactions area: ")
                .orMoreThanOne(function () {
                    console.warn("More than one transactions area option found")
                });
            if (transactionsAreaOption.isNotEmpty()) {
                transactionsAreaOption.closest("select").val(transactionsAreaOption.val());
            }

            submits
                .orElse(function () {
                    throw "No submit control found"
                })
                .first()
                .print("Submit: ")
                .sendClickEvent();
            /* IMPORTANT: don't use form.submit() as it causes an incorrect page load from within the frame */

            // TODO: consider transactions area select:
            return {transition: "checkUserIsLoggedIn"};
        }
    });

    fsm.addState("checkUserIsLoggedIn", {
        fInPageContext: function ($) {
            var initialPageTexts = fsm.getGlobalStateValue("pageText");

            fsm.setGlobalStateValue("pageText", "<garbage collected>");

            if ($("body").findPassword().isNotEmpty()) {
                console.error("User is not logged-in");

                // TODO: check if it is the same page
                // (this could be a different page if e.g. the account has been locked).
                // Idea: set an attribute to the body element and check if it is still there.
                var currentPageTexts = $("body").visibleTexts();
                var errors = currentPageTexts.diff(initialPageTexts);
                if (errors.length === 0) {
                    console.error("No error messages found");
                } else {
                    console.data("Page error messages", errors.join("\n"));
                }

                return {transition: "immediateExit"};
            }
            return {transition: "findHolderName"};
        },
        isReadOnly: true
    });

    fsm.addState("findHolderName", {
        fInPageContext: function ($) {
            var pageText = $("body").text();
            var bySalutation = pageText.match(/(Gr\u00FC\u00DF\sGott|Servus|Guten\s(Morgen|Tag|Abend)),?\s((Herr|Frau)\s)?([A-Za-z\s]+)/);
            if (bySalutation) {
                var holder = bySalutation[bySalutation.length - 1];
            } else {
                var byLabel = pageText.match(/(Kontoinhaber|Inhaber):?\s((Herr|Frau)\s)?([A-Za-z\s]+)/);
                if (byLabel) {
                    var holder = byLabel[byLabel.length - 1];
                }
            }
            if (holder) {
                console.data("Account holder", holder);
            }
            return {transition: "processByAccountType"};
        },
        isReadOnly: true
    });

    fsm.addState("processByAccountType", {
        f: function () {
            if (!fsm.getGlobalStateValue("checkingTransactionsProcessing")) {
                console.info("Processing checking accounts...")
                fsm.setGlobalStateValue("checkingTransactionsProcessing", true);
                return {transition: "findTransactionsPage"};
            } else if (!fsm.getGlobalStateValue("creditCardTransactionsProcessing")) {
                console.info("Processing credit cards...");
                fsm.setGlobalStateValue("creditCardTransactionsProcessing", true);
                return {transition: "findTransactionsPage"};
            }
            return {transition: "logout"};
        }
    });

    fsm.addState("findTransactionsPage", {
        fInPageContext: function ($) {
            var isCreditCardsProcessing = fsm.getGlobalStateValue("creditCardTransactionsProcessing");

            var links = $("body")
                .clickable()
                .filter(function () {
                    var m = match($(this).text(), $(this).attr("alt"), $(this).attr("title"));
                    var isTransactionsLink = m(/(Ums\u00e4tze|Umsatz)/i);
                    if (isTransactionsLink) {
                        var isCreditCardsTransactionsLink = m(/Kredit/);
                        return (!isCreditCardsProcessing && !isCreditCardsTransactionsLink) || (isCreditCardsProcessing && isCreditCardsTransactionsLink);
                    }
                    return false;
                })
                .orElse(function () {
                    console.warn("Transactions link" + (isCreditCardsProcessing ? " for credit cards" : "") + " not found")
                });

            if (links.isEmpty()) {
                // Further processing for other account types:
                return {transition: "processByAccountType"};
            }

            if (!isCreditCardsProcessing) {
                links = links
                    .filter(function () {
                        var linkText = $(this).text();
                        var isCheckingTransactionsLink = linkText.indexOf("PayPal") === -1 && linkText.indexOf("Depot") === -1;
                        if (!isCheckingTransactionsLink) {
                            $(this).print("Filter out: ");
                        }
                        return isCheckingTransactionsLink;
                    });
            }

            links
                .print("Transaction link" + (isCreditCardsProcessing ? " for credit cards" : "") + ": ")
                .first()
                .print("Click on ")
                .sendClickEvent();

            return {transition: "findAccounts"};
        }
    });

    fsm.addState("findAccounts", {
        fInPageContext: function ($) {
            var accountsDropbox = $.findAccountsDropbox();
            if (accountsDropbox.isEmpty()) {
                console.info("Accounts drop-box not found (is there only one account?)");
                fsm.setGlobalStateValue("currentAccounts", []);
                return {transition: "setDatesRange"};
            }

            fsm.setGlobalStateValue("currentAccounts", accountsDropbox
                .find("option")
                .map(function () {
                    return $(this).text()
                })
                .filter(function () {
                    return !this.match(/Alle|w\u00e4hlen/i)
                })
                .get());

            return {transition: "selectNextAccount"};
        },
        isReadOnly: true
    });

    fsm.addState("selectNextAccount", {
        fInPageContext: function ($) {
            var currentAccounts = fsm.getGlobalStateValue("currentAccounts");

            var nextAccount = currentAccounts.pop();
            var option = $("option:contains('" + nextAccount + "')");
            option.closest("select").val(option.val());

            console.info("Select account '" + option.text() + "'");
            console.data("Account", nextAccount);

            fsm.setGlobalStateValue("currentAccounts", currentAccounts);
            fsm.setGlobalStateValue("nextPage", null);

            return {transition: "setDatesRange"};
        },
        isReadOnly: true
    });

    fsm.addState("inputDatesRange", {
        f: function () {
            var validate = function (date) {
                if (!date) {
                    return "";
                }

                if (date.match(/^\d{2}\.\d{2}\.\d{2,4}$/)) {
                    return date;
                }

                console.error("Incorrect date: '" + date + "'. Valid date format is 'dd.MM.yyyy'.");

                return "";
            };

            console.logWithNoCaretReturn("\n\tFrom date:\t");
            var fromDate = validate(require("system").stdin.readLine());

            console.logWithNoCaretReturn("\tTo date:\t");
            var toDate = validate(require("system").stdin.readLine());

            console.log("");

            if (!fromDate || !toDate) {
                // TODO: defaulting to the current month.
                // TODO: check if from date is equal to or greater than the to date.
                return {transition: "inputDatesRange"};
            }

            fsm.setGlobalStateValue("fromDate", fromDate);
            fsm.setGlobalStateValue("toDate", toDate);
            fsm.setGlobalStateValue("isDatesRangeSet", true);

            return {transition: "setDatesRange"};
        }
    });

    fsm.addState("setDatesRange", {
        fInPageContext: function ($) {
            var datesRangeInputs = $.findDatesRange();
            if (datesRangeInputs.from && datesRangeInputs.to) {
                if (!fsm.getGlobalStateValue("isDatesRangeSet")) {
                    return {transition: "inputDatesRange"};
                }

                // TODO: click on the controls and check if the radio button is active.
                // Click the radio button if any:
                var fromDateOffset = datesRangeInputs.from.offset();
                var fromDateHeight = datesRangeInputs.from.height();
                var radio = $("input[type='radio']:visibleExt")
                    .filter(function () {
                        var offset = $(this).offset();
                        return offset.top >= fromDateOffset.top && offset.top < (fromDateOffset.top + fromDateHeight / 2) && offset.left < fromDateOffset.left;
                    })
                    .orElse(function () {
                        console.info("Radio button for the dates range section not found")
                    })
                    .print("Radio button for the dates range section: ")
                    .sendClickEvent();

                var setInputValue = function (el, key) {
                    datesRangeInputs.from.print("'" + key + "' input: ");

                    var date = fsm.getGlobalStateValue(key);
                    console.info("Setting value '" + date + "' for the '" + key + "' input...");
                    el.typeText("");
                    el.typeText(date);
                };

                setInputValue(datesRangeInputs.from, "fromDate");
                setInputValue(datesRangeInputs.to, "toDate");

                fsm.setGlobalStateValue("fromDate", null);
                fsm.setGlobalStateValue("toDate", null);
                fsm.setGlobalStateValue("isDatesRangeSet", false);
            }

            /*
            var periodDropbox = $.findPeriodDropbox();
            var periodValues = periodDropbox
                .find("option")
                .map(function() {
                    var days = $(this).text().match(/\d+/);
                    if (!days) {
                        return null;
                    }
                    return { days: Number(days[0]), val: $(this).val() }
                })
                .filter(function() { return this != null })
                .sort(function(a, b) { return b.days - a.days })
                .orElse(function() { console.warn("Period values not found") });

            if (periodValues.isNotEmpty()) {
                // Set the maximal period:
                console.info("Load transactions for last " + periodValues.get(0).days + " days");
                periodDropbox.val(periodValues.get(0).val);
            }
            */

            return {transition: "submitTransactionsParameters"};
        }
    });

    fsm.addState("submitTransactionsParameters", {
        fInPageContext: function ($) {
            var accountsDropbox = $.findAccountsDropbox();
            if (accountsDropbox.isNotEmpty()) {
                var formControl = accountsDropbox;
            } else {
                console.info("Transactions search form doesn't contain any accounts drop-box");

                var periodDropbox = $.findPeriodDropbox();
                if (periodDropbox.isNotEmpty()) {
                    var formControl = periodDropbox;
                } else {
                    console.warn("Transactions search form doesn't contain any period drop-box");

                    var dateRangesInputs = $.findDatesRange();
                    if (!dateRangesInputs.from) {
                        console.warn("Transactions search form doesn't contain any date inputs");
                    } else {
                        var formControl = dateRangesInputs.from;
                    }
                }
            }

            if (!formControl) {
                console.warn("Transactions parameters form not found");
                return {transition: "processTransactionsPage"};
            }

            formControl
                .closest("form")
                .clickable()
                .filter(function () {
                    return match(
                        $(this).text(), $(this).attr("alt"), $(this).attr("title"), $(this).val())
                    (/weiter|anzeigen|aktualisieren|Suche/i);
                })
                .orElse(function () {
                    throw "Update search criteria link not found"
                })
                .orMoreThanOne(function () {
                    console.warn("Found more than one update search criteria link")
                })
                .sortSubmitFirst()
                .first()
                .print("Update search criteria link: ")
                .sendClickEvent();

            return {transition: "processTransactionsPage"};
        }
    });

    fsm.addState("processTransactionsPage", {
        fInPageContext: function ($) {
            /*
            var csvLink = $("body")
                .clickable()
                .filter(function() {
                    return match($(this).text(), $(this).attr("alt"), $(this).attr("title"))(/CSV|Export|Excel/i);
                })
                .print("CSV link: ");

            if (csvLink.isEmpty()) {
                console.warn("CSV link not found");
            } else {
                console.info("CSV link found");
                csvLink.sendClickEvent();
            }
            */

            // TODO: use orElse.
            var transactions = $("body").findTransactions();
            if (!transactions) {
                console.info("Transactions not found");
            } else {
                console.data("Transactions", transactions);
            }

            var nextPage = fsm.getGlobalStateValue("nextPage") || 2;
            var nextPageLink = $("body").findNextPageLink(nextPage);
            if (nextPageLink.isEmpty()) {
                console.debug("Transactions paging not found");
            } else {
                // TODO: check if the first entry has been changed!
                nextPageLink.print("Next page control: ");

                console.info("Page number: " + nextPage);

                fsm.setGlobalStateValue("nextPage", ++nextPage);

                nextPageLink.first().sendClickEvent();

                return {transition: "processTransactionsPage"};
            }

            var currentAccounts = fsm.getGlobalStateValue("currentAccounts");
            if (currentAccounts && currentAccounts.length) {
                return {transition: "selectNextAccount"};
            }

            console.info("All accounts of the current type have been processed");
            return {transition: "processByAccountType"};
        }
    });

    fsm.addState("logout", {
        fInPageContext: function ($) {
            $.findLogoutLink()
                .orElse(function () {
                    throw "Logout link not found"
                })
                .print("Logout link: ")
                .sendClickEvent();

            return {transition: "checkUserLoggedOut"};
        }
    });

    fsm.addState("checkUserLoggedOut", {
        fInPageContext: function ($) {
            $.findLogoutLink()
                .orNotEmpty(function () {
                    console.warn("Page still contains a logout link")
                })
                .print("Possible logout link: ");
            return {transition: "exitAfterLogout"};
        },
        isReadOnly: true
    });

    var printFsmData = function () {
        fsm.printGlobalState();
        console.info("\n\nExecuted:\n\n" + fsm.getTransitionsExecutionHistory().join("\n"));
    };

    fsm.addState("exitAfterLogout", {
        f: function () {
            printFsmData();
            phantom.exit();
        },
        isReadOnly: true
    });

    fsm.addState("immediateExit", {
        f: function () {
            printFsmData();
            phantom.exit(1);
        }
    });

    fsm.addState("exit", {
        f: function (url) {
            var getPriorStateName = function () {
                return fsm.getTransitionsExecutionHistory().reverse()[1];
            };
            if (getPriorStateName() === "logout") {
                // To avoid infinite loop if an exception is thrown in the logout transition:
                return {transition: "immediateExit"};
            }
            return {transition: "logout"};
        },
        isReadOnly: true
    });

    return fsm;
};
