define([
    'knockout',
    'underscore',
    'uuid',
    'arches',
    'views/components/workflows/summary-step',
    'views/components/annotation-summary',
], function(ko, _, uuid, arches, SummaryStep) {

    function viewModel(params) {
        var self = this;

        params.form.resourceId(params.sampleObjectResourceId);
        const digitalResourceServiceIdentifierContentNodeId = '56f8e9bd-ca7c-11e9-b578-a4d18cec433a';
        const manifestUrl = params.imageStepData[digitalResourceServiceIdentifierContentNodeId];
        const digitalReferenceResourceId = params.digitalReferenceResourceId;

        
        this.regionInstances = params.regionsStepData.map(function(data){
            return {
                regionName: data.data["3e541cc6-859b-11ea-97eb-acde48001122"],
                regionResource: data.data["b240c366-8594-11ea-97eb-acde48001122"][0]["resourceId"],
            };
        });

        SummaryStep.apply(this, [params]);

        this.objectAnnotations = ko.observableArray();
        this.resourceData.subscribe(function(val){
            this.displayName = val['displayname'] || 'unnamed';
            const digitalReference = val.resource['Digital Reference'].find(function(val){
                return val['Digital Source']['resourceId'] === digitalReferenceResourceId;
            });
            this.reportVals = {
                parentObject: {'name': 'Object', 'value': this.getResourceValue(val.resource, ['part of', '@display_value'])},
                digitalReference: {'name': 'Image Service', 'value': digitalReference['Digital Source']["@display_value"]},
            };
            var annotationCollection = {};
            val.resource['Part Identifier Assignment'].forEach(function(annotation){
                const annotationName = self.getResourceValue(annotation,['Part Identifier Assignment_Physical Part of Object','@display_value']);
                const annotationLabel = self.getResourceValue(annotation,['Part Identifier Assignment_Label','@display_value']);
                const annotator = self.getResourceValue(annotation,['Part Identifier Assignment_Annotator','@display_value']);
                const annotationStr = self.getResourceValue(annotation,['Part Identifier Assignment_Polygon Identifier','@display_value']);
                const tileId = self.getResourceValue(annotation,['Part Identifier Assignment_Polygon Identifier','@tile_id']);
                if (annotationStr) {
                    const annotationJson = JSON.parse(annotationStr.replaceAll("'",'"'));
                    if (annotationJson.features.length > 0){
                        const currentManifestUrl = annotation['Part Identifier Assignment_Polygon Identifier']['geojson']['features'][0]['properties']['manifest'];
                        console.log(currentManifestUrl,manifestUrl)
                        if (currentManifestUrl === manifestUrl){
                            const canvas = annotationJson.features[0].properties.canvas;
                            annotationJson.features.forEach(function(feature){
                                feature.properties.tileId = tileId;
                            });
                            if (canvas in annotationCollection) {
                                annotationCollection[canvas].push({
                                    tileId: tileId,
                                    annotationName: annotationName,
                                    annotationLabel: annotationLabel,
                                    annotator: annotator,
                                    annotationJson: annotationJson,
                                });
                            } else {
                                annotationCollection[canvas] = [{
                                    tileId: tileId,
                                    annotationName: annotationName,
                                    annotationLabel: annotationLabel,
                                    annotator: annotator,
                                    annotationJson: annotationJson,
                                }];
                            }    
                        }
                    }    
                }
            });

            for (const canvas in annotationCollection) {
                let name;
                let annotationCombined;
                let info = [];
                annotationCollection[canvas].forEach(function(annotation){
                    name = annotation.annotationName;
                    if (annotationCombined) {
                        annotationCombined.features = annotationCombined.features.concat(annotation.annotationJson.features);
                    } else {
                        annotationCombined = annotation.annotationJson;
                    }
                    info.push({
                        tileId: annotation.tileId,
                        name: annotation.annotationName,
                        annotator: annotation.annotator,
                    });
                });

                const leafletConfig = self.prepareAnnotation(annotationCombined);
                self.objectAnnotations.push({
                    name: name,
                    info: info,
                    leafletConfig: leafletConfig,
                    featureCollection: annotationCombined,
                });
            }
            this.loading(false);
        }, this);
    }

    ko.components.register('analysis-areas-final-step', {
        viewModel: viewModel,
        template: { require: 'text!templates/views/components/workflows/analysis-areas-workflow/analysis-areas-final-step.htm' }
    });
    return viewModel;
});
