# @fquery/ui-core

runtimeおよびframeworkから独立したViewModel、Presentation FAM、GUI Event ABIを提供する。

このpackageはFAMを実行・解釈しない。engineが確定したstateをViewへ局所投影し、GUI操作を`*.requested` eventとしてHostへ返すController境界である。

- `PresentationFam`: renderer非依存の描画意味とopaqueな`layoutSlotRef`
- `PluginPresentationRegistry`: capabilityからpresentationを発見
- `PluginPresentationRegistry.project`: native／generic／ghost投影
- `GuiEventAbi`: Model mutationを直接行わないrequest event
- `applyEnginePresentationEvent`: engine eventをnode/ref単位で局所更新

pixel座標、width/height、zoom、viewport等の実値はPresentation FAMへ保存せず、Hostが`layoutSlotRef`を介してIBD／SQL／KV等へ委譲する。`@fquery/ui-core`はIBDをimportしない。
