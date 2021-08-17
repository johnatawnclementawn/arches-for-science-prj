define([
    'knockout',
    'underscore',
    'uuid',
    'arches',
    'views/components/workflows/summary-step',
], function(ko, _, uuid, arches, SummaryStep) {

    function viewModel(params) {
        var self = this;

        params.form.resourceId = params.form.externalStepData.instrumentinfo.data["instrument-info"][0][1]["observationInstanceId"];
        SummaryStep.apply(this, [params]);

        this.resourceLoading = ko.observable(true);
        this.parentPhysThingLoading = ko.observable(true);
        this.digitalResourceLoading = ko.observable(true);
        this.fileLists = ko.observableArray();

        this.tableConfig = {
            "info": false,
            "paging": false,
            "scrollCollapse": true,
            "searching": false,
            "ordering": false,
            "columns": [
                null,
                null,
                null,
            ]
        };

        this.uploadedDatasets = params.form.externalStepData.digitalresource.data['select-dataset-files-step'][0][1]["parts"];

        this.getResourceDataBeta = function(resourceid, resourceData) {
            window.fetch(this.urls.api_resources(resourceid) + '?format=json&compact=false&v=beta')
                .then(response => response.json())
                .then(data => resourceData(data));
        };    

        this.uploadedDatasets.forEach(function(dataset){
            var selectedDatasetData = ko.observableArray();
            var fileList = ko.observableArray();

            self.getResourceDataBeta(dataset.datasetId, selectedDatasetData);
            selectedDatasetData.subscribe(function(val){
                var findStatementType= function(statements, type){
                    var foundStatement = _.find(statements, function(statement) {
                        return statement.type.indexOf(type) > -1;
                    });
                    return foundStatement ? foundStatement.statement : "None";
                };

                var digitalResourceName = val.displayname;

                var files = val.resource['File'].map(function(file){
                    var statements = [];
                    var fileName = self.getResourceValue(file['file_details'][0], ['name']);
                    if (file["FIle_Statement"]) {
                        statements = file["FIle_Statement"].map(function(statement){
                            return {
                                statement: self.getResourceValue(statement, ['FIle_Statement_content','@display_value']),                        
                                type: self.getResourceValue(statement, ['FIle_Statement_type','@display_value'])
                            };
                        });
                    }
                    return {
                        fileName: fileName,
                        statements: statements,
                    };
                });
    
                files.forEach(function(file){
                    var fileName = file.fileName;
                    var fileInterpretation = findStatementType(file.statements, 'interpretation');
                    var fileParameter = findStatementType(file.statements, 'brief text');    
                    fileList.push({
                        name: fileName,
                        interpretation: fileInterpretation,
                        parameter: fileParameter,
                    });
                });

                self.fileLists.push({
                    digitalResourceName: digitalResourceName,
                    //annotationConfig: annotation,
                    fileList: fileList,
                });
                self.digitalResourceLoading(false);
                if (!self.resourceLoading()){
                    self.loading(false);
                }
            });
        }, this);

        var parentPhysThingResourceId = params.form.externalStepData.projectinfo.data['select-phys-thing-step'][0][1].physicalThing;
        this.parentPhysThingData = ko.observableArray();
        this.parentPhysThingRelatedData = ko.observableArray();
        this.parentPhysThingAnnotations = ko.observableArray();

        this.getResourceData(parentPhysThingResourceId, this.parentPhysThingData);

        this.parentPhysThingData.subscribe(function(val){
            val.resource['Part Identifier Assignment'].forEach(function(annotation){
                var annotationName = self.getResourceValue(annotation,['Part Identifier Assignment_Physical Part of Object','@value']);
                var annotationLabel = self.getResourceValue(annotation,['Part Identifier Assignment_Label','@value']);
                var annotator = self.getResourceValue(annotation,['Part Identifier Assignment_Annotator','@value']);
                var annotationStr = self.getResourceValue(annotation,['Part Identifier Assignment_Polygon Identifier','@value']);
                if (annotationStr) {
                    var annotationJson = JSON.parse(annotationStr.replaceAll("'",'"'));
                    var leafletConfig = self.prepareAnnotation(annotationJson);
                }

                self.parentPhysThingAnnotations.push({
                    name: annotationName,
                    label: annotationLabel,
                    annotator: annotator,
                    leafletConfig: leafletConfig,
                });
            });
            this.parentPhysThingLoading(false);
            if (!this.resourceLoading()){
                this.loading(false);
            }
        }, this);
        
        this.resourceData.subscribe(function(val){ //this is the observation resource data
            var findStatementType= function(val, type){
                try {
                    self.reportVals.statements = val.resource['Statement'].map(function(val){
                        return {
                            content:  {'name': 'Instrument Parameters', 'value': self.getResourceValue(val, ['content','@value'])},
                            type: {'name': 'type', 'value': self.getResourceValue(val, ['type','@value'])}
                        };
                    });
                } catch(e) {
                    console.log(e);
                    self.reportVals.statements = [];
                }
                var foundStatement = _.find(self.reportVals.statements, function(statement) {
                    return statement.type.value.split(",").indexOf(type) > -1;
                });
                return foundStatement ? foundStatement.content : {'name': 'Instrument Parameters', 'value': 'None'};
            };
    
            this.displayName = val['displayname'] || 'unnamed';
            this.reportVals = {
                observationName: {'name': 'Experiment/Observation Name', 'value': this.getResourceValue(val.resource['Name'][0], ['content','@value'])},
                project: {'name': 'Project', 'value': this.getResourceValue(val.resource, ['part of','@value'])},
                usedObject: {'name': 'Used Object', 'value': this.getResourceValue(val.resource, ['observed','@value'])},
                usedInstrument: {'name': 'Instrument', 'value': this.getResourceValue(val.resource, ['used instrument','@value'])},
                usedProcess: {'name': 'Technique', 'value': this.getResourceValue(val.resource, ['used process','@value'])},
            };

            self.reportVals.statement = findStatementType(val, 'description');

            this.resourceLoading(false);
            if (!this.parentPhysThingLoading()){
                this.loading(false);
            }
        }, this);
    }

    ko.components.register('upload-dataset-final-step', {
        viewModel: viewModel,
        template: { require: 'text!templates/views/components/workflows/upload-dataset/upload-dataset-final-step.htm' }
    });
    return viewModel;
});