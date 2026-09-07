# @fquery/plugin-sdk

capability declaration、bind、invoke、result envelope、authorityとside effect境界を提供する。

`Decomposer` SPIはraw observationをFAMへ写像するprovider非依存境界である。FAM本文とimplementation／provider receiptを分離し、candidateはFAM Core validatorを通過するまで`resolved`へ昇格しない。`ManualNlDecomposer`もGemini／Ollamaと同じSPIへ参加する。
