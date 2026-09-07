import type { NodeRendererProps } from "@fquery/ui-react";
import { PsiNlNode } from "./PsiNlNode.js";
import { FamvimNode } from "./FamvimNode.js";
import { LambdaNlNode } from "./LambdaNlNode.js";

/** rendererHint `fquery-core-node` に対する1つのrenderer。presentationIdでCore 3 nodeを振り分ける。 */
export function CoreNodeRenderer(props: NodeRendererProps) {
  const capability = props.projection?.presentation?.presentationId ?? "";
  if (capability.includes("core.psi.nl-input")) return <PsiNlNode {...props} />;
  if (capability.includes("core.gradient.famvim")) return <FamvimNode {...props} />;
  if (capability.includes("core.lambda.nl-output")) return <LambdaNlNode {...props} />;
  return <p className="fquery-canvas-node-muted">renderer未対応: {capability}</p>;
}
