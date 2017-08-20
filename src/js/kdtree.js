// TODO: remove point.
// TODO: duplicates.
function KdTree(viewport) {

    var MAX_PRINT_SIZE = 30;

    var root;
    var size = 0;
    var maxPointStrLen = 0;

    this.getSize = function() {
        return size;
    };

    var checkPointIsInVeiwport = function(p) {
        if (p.x < viewport.xmin || p.x >= viewport.xmax || p.y < viewport.ymin || p.y >= viewport.ymax) {
            throw 'Point (x=' + p.x + ', y=' + p.y + ') is not in the viewport (xmin=' + viewport.xmin + ', ymin='
                    + viewport.ymin + ', xmax=' + viewport.xmax + ', ymax=' + viewport.ymax + ')';
        }
    };

    this.insert = function(p) {
        checkPointIsInVeiwport(p);
        root = sink(root, p, 0);
        size++;
        maxPointStrLen = Math.max(pointToString(p).length, maxPointStrLen);
    };

    var sink = function(node, p, level) {
        if (!node) {
            return {
                point : p
            };
        }
        if (((level % 2) == 0 && p.x <= node.point.x) || ((level % 2) != 0 && p.y <= node.point.y)) {
            node.lhs = sink(node.lhs, p, level + 1);
        } else {
            node.rhs = sink(node.rhs, p, level + 1);
        }
        return node;
    };

    this.nearest = function(p) {
        if (!root) {
            throw 'Tree is empty';
        }
        checkPointIsInVeiwport(p);
        var debug = {
            visited : 0
        };
        var nearest = nearestRecursive(p, root, 0, root.point, viewport, debug);
        print('Nodes visited: ' + debug.visited + ', tree size: ' + size);
        return nearest;
    };

    var dist = function(p1, p2) {
        return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
    };

    var distToRect = function(p, rect) {
        var dx = 0, dy = 0;
        if (p.x < rect.xmin) {
            dx = rect.xmin - p.x;
        } else if (p.x > rect.xmax) {
            dx = p.x - rect.xmax;
        }
        if (p.y < rect.ymin) {
            dy = rect.ymin - p.y;
        } else if (p.y > rect.ymax) {
            dy = p.y - rect.ymax;
        }
        return dx * dx + dy * dy;
    };

    var nearestRecursive = function(query, node, level, curChampion, rect, debug) {
        if (!node) {
            return curChampion;
        }

        if (debug) {
            debug.visited++;
        }

        var distToChampion = dist(curChampion, query);
        var curDist = dist(node.point, query);

        var isVertical = !(level % 2);
        if ((isVertical && query.x <= node.point.x) || (!isVertical && query.y <= node.point.y)) {
            var towardsQueryHalfPlane = node.lhs;
            var otherHalfPlane = node.rhs;
            var isOtherHalfPlaneLhs = false;
        } else {
            var towardsQueryHalfPlane = node.rhs;
            var otherHalfPlane = node.lhs;
            var isOtherHalfPlaneLhs = true;
        }

        var champion = curChampion;
        if (curDist < distToChampion) {
            var champion = node.point;
            var distToChampion = curDist;
        }

        var leftRect = {
            xmin : rect.xmin,
            xmax : isVertical ? node.point.x : rect.xmax,
            ymin : rect.ymin,
            ymax : isVertical ? rect.ymax : node.point.y
        };

        var rightRect = {
            xmin : isVertical ? node.point.x : rect.xmin,
            xmax : rect.xmax,
            ymin : isVertical ? rect.ymin : node.point.y,
            ymax : rect.ymax
        };

        var nextRect = isOtherHalfPlaneLhs ? rightRect : leftRect;
        if (towardsQueryHalfPlane) {
            var champion = nearestRecursive(query, towardsQueryHalfPlane, level + 1, champion, nextRect, debug);
        }

        if (otherHalfPlane) {
            if (isOtherHalfPlaneLhs) {
                var otherHalfPlaneRect = leftRect;
                var distToOtherPlane = distToRect(query, leftRect);
            } else {
                var otherHalfPlaneRect = rightRect;
                var distToOtherPlane = distToRect(query, rightRect);
            }

            if (distToOtherPlane < distToChampion) {
                champion = nearestRecursive(query, otherHalfPlane, level + 1, champion, otherHalfPlaneRect, debug);
            }
        }

        return champion;
    };

    this.range = function() {

    };

    var nCharsStr = function(n, delim) {
        if (!delim || !delim.length) {
            return '';
        }
        return new Array(n + 1).join(delim);
    };

    var pointToString = function(p) {
        return '(' + p.x + ', ' + p.y + ')';
    };

    var pointToStringPad = function(p, padStr) {
        var str = pointToString(p);
        if (str.length < maxPointStrLen) {
            var actPadCh = padStr || ' ';
            var half = (maxPointStrLen - str.length) / 2;
            var halfRound = Math.floor(half);
            var rest = Math.round(half) - Math.floor(half);
            return nCharsStr(halfRound + rest, actPadCh) + str + nCharsStr(halfRound, actPadCh);
        }
        return str;
    };

    var levelOrder = function() {
        var byLevel = {};
        if (!size) {
            return byLevel;
        }

        var queue = [ {
            node : root,
            level : 0,
            onLevelIndex : 1
        } ];

        var maxLevel = 0;
        while (queue.length) {
            var x = queue.shift();

            if (!byLevel[x.level]) {
                byLevel[x.level] = [];
            }
            byLevel[x.level].push(x);

            maxLevel = Math.max(maxLevel, x.level);

            var next = {
                level : x.level + 1
            };

            var node = x.node;
            if (node.lhs) {
                queue.push({
                    node : node.lhs,
                    level : x.level + 1,
                    onLevelIndex : x.onLevelIndex * 2 - 1
                });
            }
            if (node.rhs) {
                queue.push({
                    node : node.rhs,
                    level : x.level + 1,
                    onLevelIndex : x.onLevelIndex * 2
                });
            }
        }

        return byLevel;
    };

    this.toString = function() {
        if (size > MAX_PRINT_SIZE) {
            throw 'Large trees cannot be printed, size: ' + size;
        }

        var pointsByLevel = levelOrder();
        var levels = Object.keys(pointsByLevel);
        var maxLevel = new Number(levels[levels.length - 1]);

        var emptyNodeStr = nCharsStr(maxPointStrLen, ' ');
        var edgeStr = nCharsStr(maxPointStrLen, '-');
        var emptyConStr = nCharsStr(Math.round(maxPointStrLen / 2), ' ');
        var edgeConStr = nCharsStr(Math.round(maxPointStrLen / 2) - 1, '-');
        var lhsStr = emptyConStr + '+' + edgeConStr;
        var rhsStr = edgeConStr + '+' + emptyConStr;

        var replacePlaceholder = function(pattern, n, val) {
            return pattern.replace('{' + n + '}', val);
        };

        var putLhsEdge = function(to, len) {
            var str = replacePlaceholder(levelStr, to - len, lhsStr);
            for (var e = to - len + 1; e < to; e++) {
                str = replacePlaceholder(str, e, edgeStr);
            }
            return str;
        };

        var putRhsEdge = function(from, len) {
            var str = levelStr;
            for (var e = from + 1; e < from + len; e++) {
                str = replacePlaceholder(str, e, edgeStr);
            }
            return replacePlaceholder(str, from + len, rhsStr);
        }

        var maxCellsOnLastLevel = Math.pow(2, maxLevel + 1) - 1;
        var levelPattern = '';
        for (var i = 1; i <= maxCellsOnLastLevel; i++) {
            levelPattern += '{' + i + '}';
        }

        var treeStr = '';
        for ( var i in pointsByLevel) {
            var levelStr = '';
            var maxNodesPerLevel = Math.pow(2, i);
            var levelStr = new String(levelPattern);
            var edgeLength = Math.pow(2, maxLevel - i - 1);
            if (i == 0) {
                var midPoint = Math.round(maxCellsOnLastLevel / 2);
                var rootStr = pointToStringPad(pointsByLevel[0][0].node.point, '-');
                levelStr = replacePlaceholder(levelStr, midPoint, rootStr);

                levelStr = putLhsEdge(midPoint, edgeLength);
                levelStr = putRhsEdge(midPoint, edgeLength);
            } else {
                var gap = Math.pow(2, maxLevel - i);
                for ( var j in pointsByLevel[i]) {
                    var x = pointsByLevel[i][j];
                    var n = gap;
                    if (x.onLevelIndex > 1) {
                        n += (x.onLevelIndex - 1) * (gap * 2);
                    }

                    var pointStr = pointToStringPad(x.node.point, i == maxLevel ? ' ' : '-');
                    levelStr = replacePlaceholder(levelStr, n, pointStr);

                    levelStr = putLhsEdge(n, edgeLength);
                    levelStr = putRhsEdge(n, edgeLength);
                }
            }
            treeStr += levelStr.replace(/{\d+}/g, emptyNodeStr) + '\n';
        }
        return treeStr;
    };
}
