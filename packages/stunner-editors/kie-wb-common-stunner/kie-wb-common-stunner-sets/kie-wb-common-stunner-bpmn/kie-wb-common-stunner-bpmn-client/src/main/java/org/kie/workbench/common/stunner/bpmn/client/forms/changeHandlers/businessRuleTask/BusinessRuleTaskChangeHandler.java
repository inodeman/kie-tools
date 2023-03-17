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

package org.kie.workbench.common.stunner.bpmn.client.forms.changeHandlers.businessRuleTask;

import javax.enterprise.event.Event;
import javax.inject.Inject;

import org.kie.workbench.common.stunner.bpmn.definition.BusinessRuleTask;
import org.kie.workbench.common.stunner.bpmn.definition.property.task.BusinessRuleTaskExecutionSet;
import org.kie.workbench.common.stunner.forms.client.event.RefreshFormPropertiesEvent;
import org.kie.workbench.common.stunner.forms.client.widgets.container.displayer.domainChangeHandlers.DomainObjectFieldChangeHandler;

public class BusinessRuleTaskChangeHandler implements DomainObjectFieldChangeHandler<BusinessRuleTask> {

    final static String FILE_NAME_FIELD = BusinessRuleTask.EXECUTION_SET + "." + BusinessRuleTaskExecutionSet.FILE_NAME;


    // I think this is not needed since the businessRuleTask is a errai proxy and keeps
    // the form in sync with the model automatically
    private final Event<RefreshFormPropertiesEvent> refreshFormPropertiesEvent;

    private BusinessRuleTask businessRuleTask;

    // Here you might need to inject the component that reads the dmn file to update the namespaces...
    @Inject
    public BusinessRuleTaskChangeHandler(Event<RefreshFormPropertiesEvent> refreshFormPropertiesEvent) {
        this.refreshFormPropertiesEvent = refreshFormPropertiesEvent;
    }

    @Override
    public void init(BusinessRuleTask businessRuleTask) {
        this.businessRuleTask = businessRuleTask;
    }

    @Override
    public void onFieldChange(String fieldName, Object newValue) {
        if (fieldName.equals(FILE_NAME_FIELD)) {
            // Here you can update the BRT values based on the dmn file contents
            String fileName = (String) newValue;
            if (fileName == null || fileName.length() == 0) {
                businessRuleTask.getExecutionSet().getNamespace().setValue("");
            } else {
                businessRuleTask.getExecutionSet().getNamespace().setValue("modified");
            }
        }
    }
}
