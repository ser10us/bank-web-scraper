public class Point {

    final double x;
    final double y;

    Point(double x, double y) {
        this.x = x;
        this.y = y;
    }

    Point(String coordinates) {
        String[] a = coordinates.split("\\s");
        this.x = Double.parseDouble(a[0]);
        this.y = Double.parseDouble(a[1]);
    }

    double getX() {
        return x;
    }

    double getY() {
        return y;
    }

    double sqrEuclideanDistTo(Point p) {
        return Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2);
    }

    @Override
    public String toString() {
        return "(x: " + x + ", y: " + y + ")";
    }

    @Override
    public int hashCode() {
        final int prime = 31;
        int result = 1;
        long temp;
        temp = Double.doubleToLongBits(x);
        result = prime * result + (int) (temp ^ (temp >>> 32));
        temp = Double.doubleToLongBits(y);
        result = prime * result + (int) (temp ^ (temp >>> 32));
        return result;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj == null) {
            return false;
        }
        if (getClass() != obj.getClass()) {
            return false;
        }
        Point other = (Point) obj;
        if (Double.doubleToLongBits(x) != Double.doubleToLongBits(other.x)) {
            return false;
        }
        if (Double.doubleToLongBits(y) != Double.doubleToLongBits(other.y)) {
            return false;
        }
        return true;
    }
}
