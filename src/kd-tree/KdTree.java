public class KdTree implements KdTreeSpec<Viewport, Point> {

    private static final class Node {

        final Point point;

        private Node lhs;
        private Node rhs;

        Node(Point point) {
            this.point = point;
        }
    }

    private final Viewport viewport;

    private Node root;
    private int size = 0;

    public KdTree(Viewport viewport) {
        this.viewport = viewport;
    }

    private void checkPointIsInVeiwport(Point p) {
        if (p.x < viewport.xmin || p.x >= viewport.xmax || p.y < viewport.ymin || p.y >= viewport.ymax) {
            throw new IllegalArgumentException("Point (x=" + p.x + ", y=" + p.y + ") is not in the viewport (xmin="
                    + viewport.xmin + ", ymin=" + viewport.ymin + ", xmax=" + viewport.xmax + ", ymax=" + viewport.ymax + ")");
        }
    }

    @Override
    public int getSize() {
        return size;
    }

    @Override
    public void insert(Point p) {
        checkPointIsInVeiwport(p);
        root = sink(root, p, 0);
        size++;
    }

    private Node sink(Node node, Point p, int level) {
        if (node == null) {
            return new Node(p);
        }
        if (((level % 2) == 0 && p.x <= node.point.x) || ((level % 2) != 0 && p.y <= node.point.y)) {
            node.lhs = sink(node.lhs, p, level + 1);
        } else {
            node.rhs = sink(node.rhs, p, level + 1);
        }
        return node;
    }

    public Point nearest(Point p) {
        if (root == null) {
            throw new IllegalStateException("Tree is empty");
        }
        checkPointIsInVeiwport(p);
        return nearestRecursive(p, root, 0, root.point, viewport);
    }

    private double dist(Point p1, Point p2) {
        return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
    }

    private double distToRect(Point p, Viewport rect) {
        double dx = 0, dy = 0;
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
    }

    private Point nearestRecursive(Point query, Node node, int level, Point curChampion, Viewport rect) {
        if (node == null) {
            return curChampion;
        }

        double distToChampion = dist(curChampion, query);
        double curDist = dist(node.point, query);

        boolean isVertical = (level % 2) == 0;
        boolean isOtherHalfPlaneLhs;
        Node towardsQueryHalfPlane;
        Node otherHalfPlane;
        if ((isVertical && query.x <= node.point.x) || (!isVertical && query.y <= node.point.y)) {
            towardsQueryHalfPlane = node.lhs;
            otherHalfPlane = node.rhs;
            isOtherHalfPlaneLhs = false;
        } else {
            towardsQueryHalfPlane = node.rhs;
            otherHalfPlane = node.lhs;
            isOtherHalfPlaneLhs = true;
        }

        Point champion = curChampion;
        if (curDist < distToChampion) {
            champion = node.point;
            distToChampion = curDist;
        }

        Viewport leftRect = new Viewport(rect.xmin, rect.ymin, isVertical ? node.point.x : rect.xmax, isVertical ? rect.ymax
                : node.point.y);
        Viewport rightRect = new Viewport(isVertical ? node.point.x : rect.xmin, isVertical ? rect.ymin : node.point.y,
                rect.xmax, rect.ymax);

        Viewport nextRect = isOtherHalfPlaneLhs ? rightRect : leftRect;
        if (towardsQueryHalfPlane != null) {
            champion = nearestRecursive(query, towardsQueryHalfPlane, level + 1, champion, nextRect);
        }

        if (otherHalfPlane != null) {
            Viewport otherHalfPlaneRect;
            double distToOtherPlane;
            if (isOtherHalfPlaneLhs) {
                otherHalfPlaneRect = leftRect;
                distToOtherPlane = distToRect(query, leftRect);
            } else {
                otherHalfPlaneRect = rightRect;
                distToOtherPlane = distToRect(query, rightRect);
            }

            if (distToOtherPlane < distToChampion) {
                champion = nearestRecursive(query, otherHalfPlane, level + 1, champion, otherHalfPlaneRect);
            }
        }

        return champion;
    }

    @Override
    public void levelOrder() throws Exception {

    }
}
