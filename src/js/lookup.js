// TODO: use fjs for the standard Array functions.
(function ($) {
    var MIN_ERROR_MESSAGE_LENGTH = "PIN ist falsch".length;

    var time = function () {
        var start = Date.now();
        return function () {
            return Date.now() - start;
        }
    };

    // TODO: optimize.
    Array.prototype.diff = function (a) {
        return this.filter(function (e) {
            return a.indexOf(e) < 0;
        });
    };

    window.match = function () {
        var texts = $(arguments);
        return function (regexp) {
            return texts.filter(function () {
                return this && regexp.test(this)
            }).length != 0;
        }
    };

    $.fn.fold = function (f, initial) {
        return fjs.fold(f, initial)(this.get());
    };

    $.fn.removeDuplicates = function (get) {
        var filtered = [];
        var len = this.length;
        var internalArray = this.get();
        internalArray.sort();
        for (var i = 0; i < len; i++) {
            var current = get ? get(internalArray[i]) : internalArray[i];
            if (i + 1 == len) {
                var next = null;
            } else {
                var next = get ? get(internalArray[i + 1]) : get[i + 1];
            }
            if (current != next) {
                filtered[filtered.length] = internalArray[i];
            }
        }
        return $(filtered);
    };

    $.expr[":"].visibleExt = function (e) {
        var isVisible = function (e) {
            var tagName = e.tagName();
            if (!tagName) {
                return false;
            }
            if (tagName === "body" || tagName === "html") {
                return true;
            }
            if (tagName === "noscript") {
                return false;
            }
            return e.css("display") !== "none" && e.css("visibility") !== "hidden" && !(e.css("clip") || "").match(/rect\((0px,?\s){3}0px\)/);
        };

        var el = $(e);
        var offset = el.offset();
        var right = offset.left + el.width();
        var bottom = offset.top + el.height();
        return right >= 0 && bottom >= 0 &&
            isVisible(el) &&
            el.parents("*").filter(function () {
                return !isVisible($(this));
            }).length === 0; // TODO: optimize (break on first invisible)
    };

    $.fn.findVisible = function () {
        var visibleSelector = function (selectors) {
            return selectors.map(function () {
                return this + ":visibleExt"
            }).get().join(", ");
        };
        return this.find(visibleSelector($(arguments)));
    };

    $.fn.clickable = function () {
        return this.findVisible("a", "input[type='button']", "input[type='image']", "input[type='submit']", "button", "img");
    };

    $.findClickableByRegExp = function (regexp) {
        return $("body")
            .clickable()
            .filter(function () {
                return match(
                    $(this).text(), $(this).attr("alt"), $(this).attr("title"), $(this).val())
                (regexp);
            });
    };

    $.findLoginInputs = function () {
        var form = $("body")
            .findVisible("input[type='password']")
            .closest("form")
            .orElse(function () {
                console.warn("Login form not found")
            })
            .orMoreThanOne(function () {
                console.warn("More than one login form found")
            });

        var inputSelectors = ["input[type='text']", "input[type='password']", "input[type='email']", "input:not([type])"];
        if (!form.isEmpty()) {
            return form.findVisible.apply(form, inputSelectors);
        }
        return $("body").findVisible.apply($("body"), inputSelectors);
    };

    $.fn.isNotEmpty = function () {
        return this.length !== 0;
    };

    $.fn.isEmpty = function () {
        return !this.isNotEmpty();
    };

    var testCollection = function (collection, test, fallback) {
        if (!fallback || typeof fallback !== "function") {
            throw "No fallback function specified";
        }
        if (!test(collection)) {
            fallback();
        }
        return collection;
    };

    $.fn.orElse = function (fallback) {
        return testCollection(this, function (collection) {
            return collection.size() !== 0
        }, fallback);
    };

    $.fn.orMoreThanOne = function (fallback) {
        return testCollection(this, function (collection) {
            return collection.size() <= 1
        }, fallback);
    };

    $.fn.orNotEmpty = function (fallback) {
        return testCollection(this, function (collection) {
            return collection.size() === 0
        }, fallback);
    };

    var sendMouseEvent = function (eventName) {
        return this.each(function () {
            var doc = this.ownerDocument;
            var evt = doc.createEvent("MouseEvents");
            evt.initMouseEvent(eventName, true, true, doc.defaultView, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
            this.dispatchEvent(evt);
        });
    };

    $.fn.sendClickEvent = function () {
        return sendMouseEvent.bind(this)("click");
    };

    $.fn.sendMouseDownEvent = function () {
        return sendMouseEvent.bind(this)("mousedown");
    };

    $.fn.typeText = function (text) {
        return this.each(function () {
            // It is also possible to completely emulate the input, see:
            // http://stackoverflow.com/questions/596481/simulate-javascript-key-events
            try {
                for (var i in text) {
                    $(this).trigger({type: "keypress", which: text.charCodeAt(i)});
                }
            } catch (e) {
                console.warn("Keypress error: " + e);
            }
            $(this).val(text).trigger("change");
        });
    };

    $.fn.visibleText = function () {
        return this.visibleTexts().join("");
    };

    $.fn.label = function () {
        var labels = this.map(function () {
            var cleanUpLabel = function (label) {
                return label.replace(/[*:]/g, "");
            };

            var el = $(this);

            var findByLabelTag = function (forProperty) {
                if (forProperty) {
                    return cleanUpLabel(
                        el
                            .closest("body")
                            .find("label[for='" + forProperty + "']:visibleExt")
                            .first()
                            .visibleText());
                }
            };

            var labelByTag = findByLabelTag($(this).attr("name")) || findByLabelTag($(this).attr("id"));
            if (labelByTag) {
                console.debug("Input label was found by 'label' tag");
                return labelByTag;
            }

            if (el.attr("placeholder")) {
                console.debug("Input label was found by 'placeholder' attribute");
                return el.attr("placeholder");
            }

            var euclidianDist = function (xDiff, yDiff) {
                return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
            };

            var mapByDist = function (distF) {
                return function () {
                    var diff = distF($(this));
                    return {el: $(this), dist: euclidianDist(diff.xDiff, diff.yDiff)};
                };
            };

            var offset = el.offset();
            var distFromTheLeft = function (e) {
                return {
                    xDiff: offset.left - (e.offset().left + e.width()),
                    yDiff: offset.top - e.offset().top
                }
            };

            var distFromTheTop = function (e) {
                return {
                    xDiff: offset.left - e.offset().left,
                    yDiff: offset.top - (e.offset().top + e.height())
                };
            };

            var t = time();

            var elements = el
                .closest("body")
                .find(":visibleExt")
                .filter(function () {
                    // Consider only those elements which are located either on the left or on the top of the control:
                    var currentOffset = $(this).offset();
                    var paddingTop = parseInt($(this).css("padding-top"));
                    // TODO: should the label height be less than the input height, the difference
                    // must be no more than 'input height - label height', otherwise 5px (replace 10px).
                    // TODO: what is the reasonable distance (currently 10)?
                    return (Math.abs((currentOffset.top + paddingTop) - offset.top) <= 10 && currentOffset.left < offset.left) ||
                        (Math.abs(currentOffset.left - offset.left) <= 10 && currentOffset.top < offset.top);
                })
                .filter(function () {
                    return $(this).height() < $(el).height() * 2.5
                }) /* max 2.5 heights of the element */
                .filter(function () {
                    return $(this).visibleText().length >= 3
                });

            var label = cleanUpLabel(
                $.merge(
                    elements.map(mapByDist(distFromTheLeft)),
                    elements.map(mapByDist(distFromTheTop))
                )
                    .sort(function (a, b) {
                        return a.dist - b.dist
                    })
                    .orElse(function () {
                        throw "Label not found"
                    })
                    .get(0) /* take the closest element */
                    .el
                    .visibleText());

            console.debug("Label lookup took " + t() + " ms");

            return label;
        })
            .get();

        if (labels.length == 1) {
            return labels[0];
        }
        return labels;
    };

    $.fn.tagName = function () {
        if (this.length > 1) {
            throw "Tag name function cannot be applied to a collection";
        }
        var getTagNameBy = function (f) {
            if (typeof f != "undefined") {
                return f.call(this, "tagName").toLowerCase();
            }
        };
        return getTagNameBy.call($(this), $.fn.prop) || getTagNameBy.call($(this), $.fn.attr);
    };

    $.fn.print = function (prefix) {
        return this.each(function () {
            var elText = $([
                {attr: "text", val: $(this).visibleText()},
                {attr: "value", val: $(this).val()},
                {attr: "name", val: $(this).attr("name")},
                {attr: "id", val: $(this).attr("id")},
                {attr: "alt", val: $(this).attr("alt")},
                {attr: "title", val: $(this).attr("title")}
            ])
                .map(function () {
                    var e = this;
                    if (e.val == null || typeof e.val.trim == "undefined") {
                        return {attr: e.attr, val: ""};
                    }
                    return {attr: e.attr, val: e.val.trim().replace(/(\r\n|\n|\r)/gm, " ")};
                })
                .filter(function () {
                    return this.val
                })
                .map(function () {
                    return this.attr + "=" + this.val
                })
                .get()
                .join(" :: ");

            var tag = $(this).tagName();
            console.info((prefix || "") + tag + (tag == "input" ? "[" + $(this).attr("type") + "]" : "") + " > " + (elText || "<empty>"));
        });
    };

    $.fn.sortSubmitFirst = function () {
        return this.sort(function (a, b) {
            if ($(a).attr("type") == "submit") {
                return -1;
            }
            return 1;
        });
    };

    /**
     * Returns visible texts as array.
     */
    $.fn.visibleTexts = function () {
        return this
            .find(":visibleExt")
            .andSelf()
            .map(function () {
                var curText = "";
                for (var i = 0; i < this.childNodes.length; i++) {
                    var n = this.childNodes[i];
                    if (n.nodeType == Node.TEXT_NODE) {
                        curText += n.nodeValue;
                    } else if (n.tagName == "BR") {
                        curText += " ";
                    }
                }
                return curText
                    .trim()
                    .replace(/\u00AD/g, "") /* remove soft hyphen */
                    .replace(/[\n\u00A0]/g, " ") /* replace line break and non-breaking space with a regular space */
                    .replace(/\s{2,}/g, " ");
                ;
            })
            .get();
    };

    $.findAccountsDropbox = function () {
        return $("select:visibleExt option")
            .filter(function () {
                return match($(this).text())(/Konto|\d{4,}/i)
            })
            .closest("select");
    };

    $.findPeriodDropbox = function () {
        return $("select:visibleExt option")
            .filter(function () {
                return $(this).text().match(/Monat|Woche|\d\sTage/)
            })
            .closest("select");
    };

    $.findDatesRange = function () {
        var inputs = $("input[type='text']:visibleExt")
            .filter(function () {
                return $(this).val().match(/\d{2}\.\d{2}\.\d{2,4}/)
            });
        var numberOfInputs = inputs.length;
        if (numberOfInputs == 0) {
            console.debug("No dates range inputs found by regexp");
        } else {
            console.info("Found " + numberOfInputs + " date range input" + (numberOfInputs == 1 ? "" : "s") + " by regexp");
        }

        if (inputs.isEmpty()) {
            var to = $("input[type='text']:visibleExt").filter(function () {
                return $(this).label().match(/bis/)
            });
            if (to.isEmpty()) {
                console.warn("Date range inputs not found");
                return {};
            }

            if (to.length != 1) {
                console.warn("Found too many 'to date' inputs");
                return {};
            }

            console.debug("Dates range controls found by label");

            var toOffset = to.offset();

            var from = $("input[type='text']:visibleExt")
                .filter(function () {
                    var offset = $(this).offset();
                    return offset.top == toOffset.top && offset.left < toOffset.left;
                })
                .orElse(function () {
                    console.warn("'To date' input not found")
                });
        } else if (numberOfInputs == 2) {
            var first = $(inputs.get(0));
            var second = $(inputs.get(1));
            if (first.offset().left < second.offset().left) {
                var from = first;
                var to = second;
            } else {
                var from = second;
                var to = first;
            }
        }

        return {
            from: from,
            to: to
        }
    };

    $.fn.findTransactions = function () {
        var getMarginTop = function (e) {
            return Number($(e).css("margin-top").replace("px", ""));
        };

        return this
            .find(":visible") /* transaction rows might be hidden due to current scroll position */
            .filter(function () {
                return /\d,\d{2}/.test($(this).text());
            })
            .map(function () {
                var cell = $(this); // cell or some inner part of the cell
                var cellWidth = cell.width();
                var currentParent = cell.parent();
                var priorParent = cell; // actual cell
                var currentCell = cell;
                while (currentParent.length && currentParent.width() < cellWidth * 3) {
                    priorParent = currentParent;
                    currentParent = currentParent.parent();
                }

                if (currentParent.height() > priorParent.height() * 1.5 || !/\d{2}\.\d{2}\.\d{4}/.test(currentParent.text())) {
                    // Don't add rows that don't contain a date or are way to high (in comparison to the cell height):
                    return null;
                }

                var actualCell = priorParent;
                var cellTagName = actualCell.prop("tagName");
                var cells = actualCell
                    .siblings()
                    .andSelf()
                    .filter(function () {
                        return $(this).prop("tagName") == cellTagName
                    })
                    .filter(function () {
                        return $(this).text() != ""
                    });
                /* TODO: clean-up the text and match against alphanumeric values */

                var cellTop = actualCell.offset().top - getMarginTop(actualCell);
                if (cellTop == 0) {
                    return null;
                }

                var cellsWithDifferentOffset = cells.filter(function () {
                    return $(this).offset().top - getMarginTop($(this)) != cellTop
                });
                if (cellsWithDifferentOffset.length) {
                    // All table cells must have the same top offset:
                    return null;
                }

                return {
                    row: currentParent,
                    cells: cells
                };
            })
            .removeDuplicates(function (e) {
                return e.row.get(0)
                /* underlying DOM element */
            })
            .map(function () {
                var cellTexts = this.cells.map(function () {
                    return $(this).visibleText() || null;
                })
                    .get();

                if (cellTexts.length < 3) { /* a row must contain at least date, description and amount columns */
                    return null;
                }
                return cellTexts.join("; ");
            })
            .get()
            .join("\n\n");
    };

    $.fn.findNextPageLink = function (num) {
        return this.findVisible("a", "input[type='submit']")
            .filter(function () {
                return $(this).text() == num || $(this).val() == num
            });
    };

    $.findLogoutLink = function () {
        return $("body")
            .clickable()
            .filter(function () {
                return match(
                    $(this).text(), $(this).attr("alt"), $(this).attr("title"), $(this).val(), $(this).attr("name"), $(this).attr("id"))
                (/Log(\s)?out|abmelden|beenden/i);
            });
    };

    $.fn.findPassword = function () {
        return this.findVisible("input[type='password']");
    };
})(window.$CRSQ);
