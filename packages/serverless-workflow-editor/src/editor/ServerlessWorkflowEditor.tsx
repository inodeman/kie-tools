/*
 * Copyright 2021 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as React from "react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelBody,
  DrawerPanelContent,
} from "@patternfly/react-core/dist/js/components/Drawer";
import { KogitoEdit } from "@kie-tools-core/workspace/dist/api";
import { Notification } from "@kie-tools-core/notifications/dist/api";
import { Specification } from "@severlessworkflow/sdk-typescript";
import { MermaidDiagram } from "../diagram";
import svgPanZoom from "svg-pan-zoom";
import mermaid from "mermaid";
import { SwfMonacoEditorApi } from "../monaco/SwfMonacoEditorApi";
import { SwfMonacoEditor } from "../monaco/SwfMonacoEditor";
import { MonacoEditorOperation } from "../monaco/SwfMonacoEditorApi";
import {
  ChannelType,
  EditorEnvelopeLocator,
  EditorTheme,
  EnvelopeMapping,
  StateControlCommand,
} from "@kie-tools-core/editor/dist/api";
import { EmbeddedEditor, useEditorRef } from "@kie-tools-core/editor/dist/embedded";
import { EmbeddedEditorFile } from "@kie-tools-core/editor/dist/channel";

interface Props {
  /**
   * Delegation for KogitoEditorChannelApi.kogitoEditor_ready() to signal to the Channel
   * that the editor is ready. Increases the decoupling of the ServerlessWorkflowEditor from the Channel.
   */
  onReady: () => void;

  /**
   * Delegation for KogitoEditorChannelApi.kogitoEditor_stateControlCommandUpdate(command) to signal to the Channel
   * that the editor is performing an undo/redo operation. Increases the decoupling of the ServerlessWorkflowEditor
   * from the Channel.
   */
  onStateControlCommandUpdate: (command: StateControlCommand) => void;

  /**
   * Delegation for KogitoToolingWorkspaceApi.kogitoWorkspace_newEdit(edit) to signal to the Channel
   * that a change has taken place. Increases the decoupling of the ServerlessWorkflowEditor from the Channel.
   * @param edit An object representing the unique change.
   */
  onNewEdit: (edit: KogitoEdit) => void;

  /**
   * Delegation for NotificationsApi.setNotifications(path, notifications) to report all validation
   * notifications to the Channel that will replace existing notification for the path. Increases the
   * decoupling of the ServerlessWorkflowEditor from the Channel.
   * @param path The path that references the Notification
   * @param notifications List of Notifications
   */
  setNotifications: (path: string, notifications: Notification[]) => void;

  envelopeLocator: EditorEnvelopeLocator;
}

export type ServerlessWorkflowEditorRef = {
  setContent(path: string, content: string): Promise<void>;
};

const RefForwardingServerlessWorkflowEditor: React.ForwardRefRenderFunction<
  ServerlessWorkflowEditorRef | undefined,
  Props
> = (props, forwardedRef) => {
  const [initialContent, setInitialContent] = useState({
    originalContent: "",
    path: "",
  });
  const [diagramOutOfSync, setDiagramOutOfSync] = useState<boolean>(false);
  const svgContainer = useRef<HTMLDivElement>(null);
  const swfMonacoEditorRef = useRef<SwfMonacoEditorApi>(null);

  useImperativeHandle(
    forwardedRef,
    () => {
      return {
        setContent: (path: string, newContent: string): Promise<void> => {
          try {
            setInitialContent({
              originalContent: newContent,
              path: path,
            });
            return Promise.resolve();
          } catch (e) {
            console.error(e);
            return Promise.reject();
          }
        },
        getContent: (): Promise<string> => {
          return Promise.resolve(swfMonacoEditorRef.current?.getContent() || "");
        },
        getPreview: (): Promise<string> => {
          // Line breaks replaced due to https://github.com/mermaid-js/mermaid/issues/1766
          const svgContent = svgContainer.current!.innerHTML.replaceAll("<br>", "<br/>");
          return Promise.resolve(svgContent);
        },
        undo: (): Promise<void> => {
          return swfMonacoEditorRef.current?.undo() || Promise.resolve();
        },
        redo: (): Promise<void> => {
          return swfMonacoEditorRef.current?.redo() || Promise.resolve();
        },
        validate: (): Notification[] => {
          return [];
        },
        setTheme: (theme: EditorTheme): Promise<void> => {
          return swfMonacoEditorRef.current?.setTheme(theme) || Promise.resolve();
        },
      };
    },
    []
  );

  const onContentChanged = useCallback(
    (newContent: string, operation?: MonacoEditorOperation) => {
      if (operation === MonacoEditorOperation.EDIT) {
        props.onNewEdit(new KogitoEdit(newContent));
      } else if (operation === MonacoEditorOperation.UNDO) {
        props.onStateControlCommandUpdate(StateControlCommand.UNDO);
      } else if (operation === MonacoEditorOperation.REDO) {
        props.onStateControlCommandUpdate(StateControlCommand.REDO);
      }

      try {
        const workflow: Specification.Workflow = Specification.Workflow.fromSource(newContent);
        const mermaidSourceCode = workflow.states ? new MermaidDiagram(workflow).sourceCode() : "";

        if (mermaidSourceCode?.length > 0) {
          svgContainer.current!.innerHTML = mermaidSourceCode;
          svgContainer.current!.removeAttribute("data-processed");
          mermaid.init(svgContainer.current!);
          svgPanZoom(svgContainer.current!.getElementsByTagName("svg")[0]);
          svgContainer.current!.getElementsByTagName("svg")[0].style.maxWidth = "";
          svgContainer.current!.getElementsByTagName("svg")[0].style.height = "100%";
          setDiagramOutOfSync(false);
        } else {
          svgContainer.current!.innerHTML = "Create a workflow to see its preview here.";
          setDiagramOutOfSync(true);
        }
      } catch (e) {
        console.error(e);
        setDiagramOutOfSync(true);
      }
    },
    [props]
  );

  useEffect(() => {
    props.onReady.call(null);
    onContentChanged(initialContent.originalContent);
  }, [initialContent, onContentChanged, props.onReady]);

  /**
   * The reference of the Editor. It allows us to access/modify the Editor properties imperatively.
   */
  const { editor, editorRef } = useEditorRef();

  /**
   * State that handles the file. It's important to type with the File type of the @kie-tools/dist/embedded.
   * It's initialized with an empty file with the dmn extension. The file is used by the EmbeddedEditor to set the content on the Editor. Updating the file will trigger a re-render on the Editor because the EmbeddedEditor will set updated content on the Editor.
   */
  const [file, setFile] = useState<EmbeddedEditorFile>({
    fileName: "new-file",
    fileExtension: "sw.json",
    getFileContents: () =>
      Promise.resolve(
        '{\n  "id": "helloworld",\n  "version": "1.0",\n  "specVersion": "0.8",\n  "name": "Hello World Workflow",\n  "description": "Inject Hello World",\n  "start": "Hello State",\n  "states": [\n    {\n      "name": "Hello State",\n      "type": "inject",\n      "data": {\n        "result": "Hello World!"\n      },\n      "end": true\n    }\n  ]\n}'
      ),
    isReadOnly: false,
  });

  /**
   * The Editor envelope locator informs the EmbeddedEditor what file extension the Editor can open, and it maps to the respective envelope path and the Editor resources (like CSS, icons, etc).
   * On this example, we're using a local envelope. To do this, it's necessary to copy the files from the @kie-tools/kie-bc-editors-unpacked on the webpack.config
   */
  //
  const editorEnvelopeLocator: EditorEnvelopeLocator = useMemo(() => {
    return new EditorEnvelopeLocator(window.location.origin, [
      new EnvelopeMapping(
        "sw",
        "**/*.sw.+(json|yml|yaml)",
        "dist/webview/SWEditorEnvelopeApp.js",
        "dist/webview/editors/sw"
      ),
    ]);
  }, []);

  const panelContent = (
    <DrawerPanelContent isResizable={true} defaultSize={"50%"}>
      <EmbeddedEditor
        ref={editorRef}
        file={file}
        editorEnvelopeLocator={props.envelopeLocator}
        channelType={ChannelType.EMBEDDED}
        locale={"en"}
      />
    </DrawerPanelContent>
  );

  return (
    <Drawer isExpanded={true} isInline={true}>
      <DrawerContent panelContent={panelContent}>
        <DrawerContentBody style={{ overflowY: "hidden" }}>
          {initialContent.path !== "" && (
            <SwfMonacoEditor
              content={initialContent.originalContent}
              fileName={initialContent.path}
              onContentChange={onContentChanged}
              ref={swfMonacoEditorRef}
            />
          )}
        </DrawerContentBody>
      </DrawerContent>
      Check to see where the Embedded Editor fits End of Where Embedded Editor goes
    </Drawer>
  );
};

export const ServerlessWorkflowEditor = React.forwardRef(RefForwardingServerlessWorkflowEditor);
