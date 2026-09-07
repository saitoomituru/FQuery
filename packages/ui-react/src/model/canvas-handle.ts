/**
 * Hostがcanvasへ要求できる操作。renderer backend非依存の契約であり、
 * pixel座標はHostが`node.move.requested`のpayloadへ使うだけでcanonicalへ焼かない。
 */
export interface PresentationCanvasHandle {
  /** viewport中心のgraph座標。新規nodeの初期配置にHostが使う。 */
  viewportCenter(): { x: number; y: number };
  /** graph全体をviewportへ収める。未attach等で不可なら`false`。 */
  zoomToFit(): boolean;
  /** 指定nodeをviewportへ収める。nodeが無ければ`false`。 */
  focusNode(nodeId: string): boolean;
}
