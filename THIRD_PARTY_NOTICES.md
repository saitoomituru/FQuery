# Third-party notices

## BaklavaJS（historical）

`7f22e4c`以前の`@fquery/ui-vue`はBaklavaJS 2.8.1（MIT、https://github.com/newcat/baklavajs 、Copyright (c) 2019 Freddy Wagner）をnode-editor surfaceとして利用していた。Issue #36でReact Flowへ交換し、現在のpackage依存には含まれない。

## React Flow

FQueryのnode-editor Presentation adapter（`@fquery/ui-react`）は`@xyflow/react` 12系を利用します。

Project: https://github.com/xyflow/xyflow  
License: MIT

```text
MIT License

Copyright (c) 2019-2025 webkid GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Playwright

FQueryのbrowser自動検証は`@playwright/test`を開発時依存として利用します。PlaywrightによるChromium／Chrome自動検証は、実Safari／実ChromeのHuman Testを代替しません。

Project: https://github.com/microsoft/playwright

License: Apache-2.0

Copyright: Microsoft Corporation
