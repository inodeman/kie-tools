/*
 * Copyright 2021 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//import { VsCodeSWEditorFactory } from "@kie-tools/kie-bc-editors/dist/sw/envelope/vscode";
//import * as EditorEnvelope from "@kie-tools-core/editor/dist/envelope";

//declare const acquireVsCodeApi: any;

EditorEnvelope.init({
  container: document.getElementById("envelope-app")!,
  bus: acquireVsCodeApi(),
  editorFactory: new VsCodeSWEditorFactory({ shouldLoadResourcesDynamically: true }),
});

import { ServerlessWorkflowEditorFactory } from "@kie-tools/serverless-workflow-editor";
import * as EditorEnvelope from "@kie-tools-core/editor/dist/envelope";
import { VsCodeSWEditorFactory } from "@kie-tools/kie-bc-editors/dist/sw/envelope/vscode";
import { EditorEnvelopeLocator, EnvelopeMapping } from "@kie-tools-core/editor/dist/api";
import { useMemo } from "react";

declare const acquireVsCodeApi: any;

EditorEnvelope.init({
  container: document.getElementById("envelope-app")!,
  bus: acquireVsCodeApi(),
  editorFactory: new ServerlessWorkflowEditorFactory(
    new EditorEnvelopeLocator("vscode", [
      new EnvelopeMapping(
        "sw",
        "**/*.sw.+(json|yml|yaml)",
        "dist/webview/SWEditorEnvelopeApp.js",
        "dist/webview/editors/sw"
      ),
    ])
  ),
});
