/*
 * Copyright 2023 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.kie.workbench.common.stunner.bpmn.client.dataproviders;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import javax.annotation.PostConstruct;
import javax.enterprise.context.Dependent;
import javax.enterprise.event.Event;
import javax.enterprise.event.Observes;
import javax.inject.Inject;

import org.appformer.client.context.EditorContextProvider;
import org.appformer.kogito.bridge.client.resource.ResourceContentService;
import org.kie.workbench.common.forms.dynamic.model.config.SelectorData;
import org.kie.workbench.common.forms.dynamic.model.config.SelectorDataProvider;
import org.kie.workbench.common.forms.dynamic.service.shared.FormRenderingContext;
import org.kie.workbench.common.stunner.bpmn.client.util.DMNParsingUtils;
import org.kie.workbench.common.stunner.bpmn.definition.BusinessRuleTask;
import org.kie.workbench.common.stunner.bpmn.definition.property.task.BusinessRuleTaskExecutionSet;
import org.kie.workbench.common.stunner.core.client.api.SessionManager;
import org.kie.workbench.common.stunner.core.client.canvas.AbstractCanvasHandler;
import org.kie.workbench.common.stunner.core.client.canvas.CanvasHandler;
import org.kie.workbench.common.stunner.core.client.canvas.event.selection.CanvasSelectionEvent;
import org.kie.workbench.common.stunner.core.client.command.CanvasCommand;
import org.kie.workbench.common.stunner.core.client.command.CanvasCommandFactory;
import org.kie.workbench.common.stunner.core.client.command.SessionCommandManager;
import org.kie.workbench.common.stunner.core.client.event.util.FileNameElementSetterEvent;
import org.kie.workbench.common.stunner.core.graph.Element;
import org.kie.workbench.common.stunner.core.graph.content.definition.Definition;
import org.kie.workbench.common.stunner.forms.client.event.FormFieldChanged;
import org.kie.workbench.common.stunner.forms.client.event.FormPropertiesOpened;
import org.kie.workbench.common.stunner.forms.client.event.RefreshFormPropertiesEvent;
import org.uberfire.client.promise.Promises;

@Dependent
public class FileNameFormProvider implements SelectorDataProvider {

    private String namespace;
    private List<String> decisionName = new ArrayList<>();
    private String dmnModelName;
    private Element<? extends Definition<?>> element;
    @Inject
    private Event<RefreshFormPropertiesEvent> refreshFormPropertiesEvent;
    @Inject
    private SessionManager sessionManager;
    @Inject
    private CanvasCommandFactory<AbstractCanvasHandler> canvasCommandFactory;
    @Inject
    private SessionCommandManager<AbstractCanvasHandler> sessionCommandManager;
    @Inject
    private ResourceContentService resourceContentService;
    @Inject
    private Promises promises;
    @Inject
    private EditorContextProvider editorContextProvider;
    private CanvasHandler canvasHandler = null;
    private Map<String, String> fileNames = new HashMap<>();

    private final static String fileMatcher = "*.dmn";
    @PostConstruct
    public void fetchFileNames() {

        resourceContentService
                .list(fileMatcher)
                .then(paths -> {
                    if (paths.length != 0) {
                        fileNames.clear();
                        for (String path : paths) {
                            fileNames.put(path, path);
                        }
                        // Update forms in case the fileName field has a value, it needs to add it and the results returned
                        refreshFormPropertiesEvent.fire(new RefreshFormPropertiesEvent(sessionManager.getCurrentSession()));
                    }
                    return promises.resolve();
                });
   }

    protected void setInit(final Event<RefreshFormPropertiesEvent> refreshFormPropertiesEvent,
                        final SessionManager sessionManager,
                        final CanvasCommandFactory<AbstractCanvasHandler> canvasCommandFactory,
                        final SessionCommandManager<AbstractCanvasHandler> sessionCommandManager,
                        final ResourceContentService resourceContentService,
                        final Promises promises) {
        this.refreshFormPropertiesEvent = refreshFormPropertiesEvent;
        this.sessionManager = sessionManager;
        this.canvasCommandFactory = canvasCommandFactory;
        this.sessionCommandManager = sessionCommandManager;
        this.resourceContentService = resourceContentService;
        this.promises = promises;
    }

    @Override
    public String getProviderName() {
        return getClass().getSimpleName();
    }

    @Override
    public SelectorData<String> getSelectorData(final FormRenderingContext context) {
        SelectorData<String> selector = new SelectorData<>();
        selector.setValues(fileNames);
        return selector;
    }

    public void fetchFile(String fileName) {
        resourceContentService
                .get(fileName)
                .then(content -> {
                    // this should be moved to BusinessRuleTaskChangeHandler
                    namespace = DMNParsingUtils.parseNamespace(content);
                    decisionName = DMNParsingUtils.parseDecisionName(content);
                    dmnModelName = DMNParsingUtils.parseDMNModelName(content);

                    if (element != null) {
                        setParsedValues(namespace, dmnModelName);
                    }
                    return promises.resolve();
                });
    }

    private void setParsedValues(String namespace, String dmnModelName) {
        setField(BusinessRuleTask.EXECUTION_SET + "."
                + BusinessRuleTaskExecutionSet.NAMESPACE, element, namespace);
        setField(BusinessRuleTask.EXECUTION_SET + "."
                + BusinessRuleTaskExecutionSet.DECISON_NAME, element, "");
        setField(BusinessRuleTask.EXECUTION_SET + "."
                + BusinessRuleTaskExecutionSet.DMN_MODEL_NAME, element, dmnModelName);
    }

    public List<String> getDecisionName() {
        return decisionName;
    }

    public void onFormFieldChanged(@Observes FormFieldChanged formFieldChanged) {

        String fileName = formFieldChanged.getValue().toString();
        final String fileNameFieldName = "fial" + BusinessRuleTask.EXECUTION_SET + "." + BusinessRuleTaskExecutionSet.FILE_NAME;

        if (!Objects.equals(formFieldChanged.getName(), fileNameFieldName)) {
            return;
        }

        if (fileNames.get(fileName) != null) {
            fetchFile(fileName);
        } else {
            // This should be moved to BusinessRuleTaskChangeHandler
            namespace = "";
            decisionName.clear();
            dmnModelName = "";
            setParsedValues(namespace, dmnModelName);
        }
        refreshFormPropertiesEvent.fire(new RefreshFormPropertiesEvent(sessionManager.getCurrentSession(), formFieldChanged.getUuid()));
    }

    protected void onCanvasSelectionEvent(@Observes CanvasSelectionEvent event) {
        this.canvasHandler = event.getCanvasHandler();
    }

    protected void onFormsOpenedEvent(@Observes FormPropertiesOpened event) {
        this.canvasHandler = event.getSession().getCanvasHandler();
    }

    protected void onFileNameElementSetterEvent(@Observes FileNameElementSetterEvent fileNameElementSetterEvent) {
        this.element = fileNameElementSetterEvent.getElement();
    }

    protected Element<? extends Definition<?>> getElement() {
        return element;
    }

    protected void setElement(Element<? extends Definition<?>> element) {
        this.element = element;
    }

    protected CanvasHandler getCanvasHandler() {
        return canvasHandler;
    }

    protected void setCanvasHandler(CanvasHandler canvasHandler) {
        this.canvasHandler = canvasHandler;
    }

    protected String getNamespace() {
        return namespace;
    }

    protected String getDmnModelName() {
        return dmnModelName;
    }

    public Map<String, String> getFileNames() {
        return fileNames;
    }

    public void setField(final String nameField, final Element<? extends Definition> element,
                         final String text) {
        if (canvasHandler == null) {
            return;
        }
        final CanvasCommand<AbstractCanvasHandler> command = canvasCommandFactory.updatePropertyValue(element,
                nameField,
                text);
        sessionCommandManager.execute((AbstractCanvasHandler) canvasHandler,
                command);
    }
}
