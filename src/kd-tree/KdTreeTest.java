import java.io.IOException;
import java.lang.reflect.Array;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;

public class KdTreeTest {

    private static final class JsViewport extends Viewport {

        JsViewport(double xmin, double ymin, double xmax, double ymax) {
            super(xmin, ymin, xmax, ymax);
        }

        @Override
        public String toString() {
            return "{xmin:" + getXmin() + ", ymin:" + getYmin() + ", xmax:" + getXmax() + ", ymax:" + getYmax() + "}";
        }
    }

    private static final class JsPoint extends Point {

        JsPoint(double x, double y) {
            super(x, y);
        }

        JsPoint(String coordinates) {
            super(coordinates);
        }

        @Override
        public String toString() {
            return "{x: " + getX() + ", y: " + getY() + "}";
        }
    }

    private static final class JsKdTree implements KdTreeSpec<JsViewport, JsPoint> {

        private final ScriptEngine engine;

        JsKdTree(JsViewport viewport, ScriptEngine engine) throws IOException, ScriptException {
            this.engine = engine;

            engine.eval(readFile("js/kdtree.js"));
            engine.eval("var kdtree = new KdTree(" + viewport + ")");
        }

        @Override
        public int getSize() throws ScriptException {
            Object size = engine.eval("kdtree.getSize()");
            if (size instanceof Integer) {
                return (int) size;
            } else if (size instanceof Double) {
                return ((Double) size).intValue();
            } else {
                throw new UnsupportedOperationException();
            }
        }

        @Override
        public void insert(JsPoint p) throws ScriptException {
            engine.eval("kdtree.insert(" + p + ")");
        }

        @Override
        public JsPoint nearest(JsPoint p) throws Exception {
            engine.eval("var nearestP = kdtree.nearest(" + p + ")");
            return new JsPoint((String) engine.eval("nearestP.x + ' ' + nearestP.y"));
        }

        @Override
        public void levelOrder() throws Exception {
            engine.eval("kdtree.levelOrder()");
        }

        @Override
        public String toString() {
            try {
                return (String) engine.eval("kdtree.toString()");
            } catch (ScriptException e) {
                throw new IllegalStateException(e);
            }
        }
    }

    @FunctionalInterface
    private interface PointsFactory<P extends Point> {

        P createPoint(String coordinates);
    }

    private static String readFile(String path) throws IOException {
        return new String(Files.readAllBytes(Paths.get(path)));
    }

    @SuppressWarnings("unchecked")
    private static <P extends Point> P[] readPoints(String fileName, PointsFactory<P> pointsFactory) {
        List<P> points = new ArrayList<>();
        try {
            for (String line : readFile("test/kdtree/" + fileName).split("\n")) {
                points.add(pointsFactory.createPoint(line));
            }
        } catch (IOException e) {
            throw new IllegalArgumentException(fileName, e);
        }
        if (points.isEmpty()) {
            throw new IllegalStateException("File " + fileName + " does not specify any points");
        }
        return points.toArray((P[]) Array.newInstance(points.get(0).getClass(), points.size()));
    }

    private static <T> void asseretEquals(T expected, T actual) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException("Expected " + expected + " but was " + actual);
        }
    }

    private static <P extends Point> P bruteForceNearest(P query, P[] points) {
        double minDist = Integer.MAX_VALUE;
        P nearest = null;
        for (P p : points) {
            double curDist = p.sqrEuclideanDistTo(query);
            if (curDist < minDist) {
                minDist = curDist;
                nearest = p;
            }
        }
        return nearest;
    }

    public static void main(String[] args) {
        try {
            KdTreeSpec<JsViewport, JsPoint> jsKdTree = new JsKdTree(new JsViewport(0, 0, 1, 1),
                    new ScriptEngineManager().getEngineByName("JavaScript"));
            KdTreeSpec<Viewport, Point> javaKdTree = new KdTree(new Viewport(0, 0, 1, 1));

            JsPoint[] points = readPoints("circle1000.txt", (coordinates) -> new JsPoint(coordinates));

            // TODO: Balanced k-d Tree: http://arxiv.org/pdf/1410.5420v27.pdf

            for (JsPoint p : points) {
                jsKdTree.insert(p);
                javaKdTree.insert(p);
            }

            int numberOfPoints = points.length;
            asseretEquals(numberOfPoints, jsKdTree.getSize());
            asseretEquals(numberOfPoints, javaKdTree.getSize());

            // System.out.println(jsKdTree);

            for (int i = 0; i < numberOfPoints * Math.log10(numberOfPoints); i++) {
                double x = Math.random();
                double y = Math.random();
                JsPoint query = new JsPoint(x, y);
                JsPoint bruteForceNearest = bruteForceNearest(query, points);
                asseretEquals(bruteForceNearest, jsKdTree.nearest(query));
                asseretEquals(bruteForceNearest, javaKdTree.nearest(query));
            }

            // TODO: output average number of compares.
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
