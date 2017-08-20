public interface KdTreeSpec<V extends Viewport, P extends Point> {

    int getSize() throws Exception;

    void insert(P p) throws Exception;

    P nearest(P p) throws Exception;

    void levelOrder() throws Exception;

    String toString();
}
