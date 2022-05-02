/*
 * Copyright 2020 Red Hat, Inc. and/or its affiliates.
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
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { ServerlessWorkflowEmptyState } from "./EmptyState";
import type { Property } from "csstype";
import { HistoryButtons, Theme } from "./HistoryButtons";
import "./App.scss";
import { ChannelType, EditorApi, EditorTheme, StateControlCommand } from "@kie-tools-core/editor/dist/api";
import { Page, PageSection } from "@patternfly/react-core/dist/js/components/Page";
import { SwfTextEditor } from "../src";
import { SwfTextEditorController, SwfTextEditorOperation } from "../src";
import { KogitoEdit } from "@kie-tools-core/workspace/dist/api";
import { basename, extname } from "path";
import { Notification } from "@kie-tools-core/notifications/dist/api";
import { useStateControlSubscription } from "@kie-tools-core/editor/dist/embedded";

type State = string | undefined;

export const App = () => {
  const [fileContent, setFileContent] = useState<{ content: string; path: string } | undefined>(undefined);
  const [content, setContent] = useState<State>(undefined);
  const editor = useRef<EditorApi>();

  const swfTextEditorRef = useRef<SwfTextEditorController>(null);

  /*
  useStateControlSubscription(
      editor,
      useCallback(
          (isDirty) => {
            if (!isDirty || !editor) {
              return;
            }

            editor.getContent().then((content) => {
              setFileContent((prevState) => ({
                ...prevState!,
                content,
              }));
            });
          },
          [editor]
      ),
      { throttle: 200 }
  );

  useImperativeHandle(
      null,
      () => {
        return {
          setContent: async (path: string, content: string) => {
            try {
              // TODO: Improve this part or move to somewhere else?
              const regex = /(\.sw\.json|\.sw\.yaml|\.sw\.yml)$/;
              const match = regex.exec(path.toLowerCase());
              const dotExtension = match ? match[1] : extname(path);
              const extension = dotExtension ? dotExtension.slice(1) : "";

              setFileContent({ content, path });
              console.log("Setting Editor file placeholder...");
            } catch (e) {
              console.error(e);
              throw e;
            }
          },
          getContent: async () => editor?.getContent(),
          getPreview: async () => editor?.getPreview(),
          undo: async () => swfTextEditorRef.current?.undo(),
          redo: async () => swfTextEditorRef.current?.redo(),
          validate: (): Notification[] => [],
          setTheme: async (theme: EditorTheme) => swfTextEditorRef.current?.setTheme(theme),
        };
      },
      [editor]
  );

*/
  const displayServerlessWorkflowEditor = (): Property.Display => {
    return content === undefined ? "none" : "block";
  };

  const undo = (): void => {
    editor.current!.undo().finally();
  };

  const redo = (): void => {
    editor.current!.redo().finally();
  };

  const validate = () => {
    editor.current!.validate().then((notifications) => {
      window.alert(JSON.stringify(notifications, undefined, 2));
    });
  };

  const container = useRef<HTMLDivElement | null>(null);

  const onSwfTextEditorContentChanged = useCallback(
    (newContent: string, operation: SwfTextEditorOperation, versionId?: number) => {
      switch (operation) {
        case SwfTextEditorOperation.EDIT:
          // Nothing
          break;
        case SwfTextEditorOperation.UNDO:
          swfTextEditorRef.current?.undo();
          editor.current?.undo();
          break;
        case SwfTextEditorOperation.REDO:
          swfTextEditorRef.current?.redo();
          editor.current?.redo();
          break;
      }
      console.log("No diagram update needed");
    },
    []
  );

  return (
    <Page>
      {content === undefined && (
        <PageSection isFilled={true}>
          <ServerlessWorkflowEmptyState
            newContent={(type: string) => {
              setContent("");
              console.log("Attempting to create new document:" + `new-document.sw.${type}`);
              console.log("editor:" + editor);
              console.log("editor.current:" + editor.current);

              editor.current!.setContent(`new-document.sw.${type}`, "").finally();
            }}
            setContent={(path: string, content: string) => {
              setContent(content);
              editor.current!.setContent(path, content).finally();
            }}
          />
        </PageSection>
      )}

      <PageSection padding={{ default: "noPadding" }} style={{ display: displayServerlessWorkflowEditor() }}>
        <HistoryButtons
          undo={undo}
          redo={redo}
          get={() => editor.current!.getContent()}
          setTheme={(theme) => {
            if (container.current) {
              if (theme === Theme.DARK) {
                container.current?.classList.add("vscode-dark");
              } else {
                container.current?.classList.remove("vscode-dark");
              }
            }
          }}
          validate={validate}
        />
      </PageSection>
      <PageSection
        padding={{ default: "noPadding" }}
        style={{ display: displayServerlessWorkflowEditor() }}
        isFilled={true}
        hasOverflowScroll={false}
      >
        <div ref={container} className="editor-container">
          text editor goes here
          {fileContent !== undefined && (
            <SwfTextEditor
              channelType={ChannelType.ONLINE}
              content={fileContent.content}
              fileUri={fileContent.path}
              onContentChange={onSwfTextEditorContentChanged}
              ref={swfTextEditorRef}
            />
          )}
        </div>
      </PageSection>
    </Page>
  );
};
