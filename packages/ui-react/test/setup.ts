// jsdomはReact Flowが要求するResizeObserver／DOMMatrixを持たない。
// これはtest環境の都合であり、FQuery側のcodeへ測定logicを入れる理由にしない。
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });
}
if (typeof globalThis.DOMMatrixReadOnly === "undefined") {
  class DOMMatrixReadOnlyStub {
    readonly m22 = 1;
    constructor(_transform?: string) {}
  }
  Object.defineProperty(globalThis, "DOMMatrixReadOnly", { value: DOMMatrixReadOnlyStub, writable: true });
}
