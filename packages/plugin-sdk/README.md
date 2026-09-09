# @fquery/plugin-sdk

capability declaration、bind、invoke、result envelope、authorityとside effect境界を提供する。

`Decomposer` SPIはraw observationをFAMへ写像するprovider非依存境界である。FAM本文とimplementation／provider receiptを分離し、candidateの`base_structure`、選択`profile_conformance`、provider transport、Observer評価を別状態で返す。profile不適合だけで4軸candidateを消去せず、serviceが要求するprofileを満たすまで当該routeを`resolved`へ昇格しない。`ManualNlDecomposer`もGemini／Ollamaと同じSPIへ参加する。
