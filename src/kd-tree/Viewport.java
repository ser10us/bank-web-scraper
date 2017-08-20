public class Viewport {

    final double xmin;
    final double ymin;
    final double xmax;
    final double ymax;

    public Viewport(double xmin, double ymin, double xmax, double ymax) {
        this.xmin = xmin;
        this.ymin = ymin;
        this.xmax = xmax;
        this.ymax = ymax;
    }

    public double getXmin() {
        return xmin;
    }

    public double getYmin() {
        return ymin;
    }

    public double getXmax() {
        return xmax;
    }

    public double getYmax() {
        return ymax;
    }

    @Override
    public String toString() {
        return "Viewport (xmin:" + xmin + ", ymin:" + ymin + ", xmax:" + xmax + ", ymax:" + ymax + ")";
    }
}
