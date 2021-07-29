define([
    'underscore',
    'jquery',
    'arches',
    'knockout',
    'knockout-mapping',
    'models/graph',
    'viewmodels/card',
    'views/components/iiif-annotation',
], function(_, $, arches, ko, koMapping, GraphModel, CardViewModel, IIIFAnnotationViewmodel) {
    function viewModel(params) {
        var self = this;
        _.extend(this, params);
        
        var selectProjectStepData = params.form.externalStepData['selectprojectstep']['data'];
        this.physicalThingResourceId = koMapping.toJS(selectProjectStepData['select-phys-thing'][0][1]['physicalThing']);
        
        var digitalResourceServiceIdentifierContentNodeId = '56f8e9bd-ca7c-11e9-b578-a4d18cec433a';
        var imageStepData = params.form.externalStepData['imagestep']['data']['image-service-instance'][0];
        this.manifestUrl = ko.observable(imageStepData.data[digitalResourceServiceIdentifierContentNodeId]);


        var sampleInfoStepData = params.form.externalStepData['sampleinfostep']['data'];
        this.samplingActivityResourceId = koMapping.toJS(sampleInfoStepData['sampling-info'][0][1]['samplingActivityResourceId']);

        this.samplingActivitySamplingUnitCard = ko.observable();
        
        this.savingTile = ko.observable();

        this.physicalThingPartIdentifierAssignmentCard = ko.observable();
        this.physicalThingPartIdentifierAssignmentTile = ko.observable();

        this.partIdentifierAssignmentLabelWidget = ko.observable();
        this.partIdentifierAssignmentPolygonIdentifierWidget = ko.observable();

        this.previouslySavedSampleDescriptionWidgetValue = ko.observable();
        this.sampleDescriptionWidgetValue = ko.observable();

        this.previouslySavedMotivationForSamplingWidgetValue = ko.observable();
        this.motivationForSamplingWidgetValue = ko.observable();

        this.activeTab = ko.observable();
        this.hasExternalCardData = ko.observable(false);

        this.sampleLocationInstances = ko.observableArray();
        
        this.selectedSampleLocationInstance = ko.observable();
        this.selectedSampleLocationInstance.subscribe(function(selectedSampleLocationInstance) {
            self.highlightAnnotation();

            if (selectedSampleLocationInstance) {
                /* TODO: switchCanvas logic */ 
                
                self.tile = selectedSampleLocationInstance;
                params.tile = selectedSampleLocationInstance;
                self.physicalThingPartIdentifierAssignmentTile(selectedSampleLocationInstance);
            }
        });

        this.tileDirty = ko.computed(function() {
            if (
                self.sampleDescriptionWidgetValue() && self.sampleDescriptionWidgetValue() !== self.previouslySavedSampleDescriptionWidgetValue()
            ) {
                return true;
            }
            else if (
                self.motivationForSamplingWidgetValue() && self.motivationForSamplingWidgetValue() !== self.previouslySavedMotivationForSamplingWidgetValue()
            ) {
                return true;
            }
            else if (self.physicalThingPartIdentifierAssignmentTile()) {
                return self.physicalThingPartIdentifierAssignmentTile().dirty();
            }
        });

        this.selectedSampleLocationInstanceFeatures = ko.computed(function() {
            var partIdentifierAssignmentPolygonIdentifierNodeId = "97c30c42-8594-11ea-97eb-acde48001122";  // Part Identifier Assignment_Polygon Identifier (E42)

            if (self.selectedSampleLocationInstance()) {
                if (ko.unwrap(self.selectedSampleLocationInstance().data[partIdentifierAssignmentPolygonIdentifierNodeId])) {
                    var partIdentifierAssignmentPolygonIdentifierData = ko.unwrap(self.selectedSampleLocationInstance().data[partIdentifierAssignmentPolygonIdentifierNodeId]);
                    return ko.unwrap(partIdentifierAssignmentPolygonIdentifierData.features);
                }
            }
        });

        this.sampleLocationFilterTerm = ko.observable();
        this.filteredSampleLocationInstances = ko.computed(function() {
            if (self.sampleLocationFilterTerm()) {
                return self.sampleLocationInstances().filter(function(sampleLocationInstance) {
                    var partIdentifierAssignmentLabelNodeId = '3e541cc6-859b-11ea-97eb-acde48001122';
                    return sampleLocationInstance.data[partIdentifierAssignmentLabelNodeId]().includes(self.sampleLocationFilterTerm());
                });
            }
            else {
                return self.sampleLocationInstances();
            }
        });

        this.hasExternalCardData.subscribe(function(hasExternalCardData) {
            if (hasExternalCardData) {
                self.handleExternalCardData();

                /* sets all Physical Thing geometries to visible */
                var physicalThingGeometriestAnnotationSubscription = self.annotationNodes.subscribe(function(annotationNodes) {
                    self.setPhysicalThingGeometriesToVisible(annotationNodes);
                    physicalThingGeometriestAnnotationSubscription.dispose(); /* self-disposing subscription only runs once */
                });

                self.activeTab('dataset');

                self.manifest(self.manifestUrl());
                self.getManifestData();
            }
        });

        this.initialize = function() {
            params.form.save = self.saveWorkflowStep;

            $.getJSON(arches.urls.api_card + self.physicalThingResourceId).then(function(data) {
                self.loadExternalCardData(data);
            });

            var samplingUnitNodegroupId = 'b3e171a7-1d9d-11eb-a29f-024e0d439fdb';  // Sampling Unit (E80)
                
            self.fetchCardFromResourceId(self.samplingActivityResourceId, samplingUnitNodegroupId).then(function(samplingActivitySamplingUnitCard) {
                self.samplingActivitySamplingUnitCard(samplingActivitySamplingUnitCard);
            });
        };

        this.getSampleLocationTileFromFeatureId = function(featureId) {
            var partIdentifierAssignmentPolygonIdentifierNodeId = "97c30c42-8594-11ea-97eb-acde48001122";  // Part Identifier Assignment_Polygon Identifier (E42)

            return self.sampleLocationInstances().find(function(sampleLocationInstance) {
                var sampleLocationInstanceFeatures = sampleLocationInstance.data[partIdentifierAssignmentPolygonIdentifierNodeId].features();

                return sampleLocationInstanceFeatures.find(function(sampleLocationInstanceFeature) {
                    return ko.unwrap(sampleLocationInstanceFeature.id) === featureId;
                });
            });
        };

        this.switchCanvas = function(canvasId){
            var canvas = self.canvases().find(c => c.images[0].resource.service['@id'] === canvasId);
            if (canvas) {
                self.canvasClick(canvas);              
            }
        };

        this.getAnnotationProperty = function(tile, property){
            return tile.data[self.annotationNodeId].features[0].properties[property];
        };

        this.highlightAnnotation = function(){
            if (self.map()) {
                self.map().eachLayer(function(layer){
                    if (layer.eachLayer) {
                        layer.eachLayer(function(features){
                            if (features.eachLayer) {
                                features.eachLayer(function(feature) {
                                    var defaultColor = feature.feature.properties.color;
                                    
                                    if (self.selectedSampleLocationInstance() && self.selectedSampleLocationInstance().tileid === feature.feature.properties.tileId) {
                                        feature.setStyle({color: '#BCFE2B', fillColor: '#BCFE2B'});
                                    } else {
                                        feature.setStyle({color: defaultColor, fillColor: defaultColor});
                                    }
                                });
                            }
                        });
                    }
                })
            } 
        };

        this.selectSampleLocationInstance = function(sampleLocationInstance) {
            self.sampleDescriptionWidgetValue(null);
            self.previouslySavedSampleDescriptionWidgetValue(null);
            
            self.motivationForSamplingWidgetValue(null);
            self.previouslySavedMotivationForSamplingWidgetValue(null);

            var previouslySelectedSampleLocationInstance = self.selectedSampleLocationInstance();

            /* resets any changes not explicity saved to the tile */ 
            if (previouslySelectedSampleLocationInstance) {
                previouslySelectedSampleLocationInstance.reset();
                self.drawFeatures([]);
            }

            self.selectedSampleLocationInstance(sampleLocationInstance);

            if (self.selectedSampleLocationInstance() && self.samplingActivitySamplingUnitCard()) {
                var partIdentifierAssignmentPhysicalPartOfObjectNodeId = 'b240c366-8594-11ea-97eb-acde48001122';   

                var selectedSampleLocationParentPhysicalThingData = ko.unwrap(self.selectedSampleLocationInstance().data[partIdentifierAssignmentPhysicalPartOfObjectNodeId]);
                
                var selectedSampleLocationParentPhysicalThingResourceId;
                if (selectedSampleLocationParentPhysicalThingData) {
                    selectedSampleLocationParentPhysicalThingResourceId = ko.unwrap(selectedSampleLocationParentPhysicalThingData[0].resourceId);
                } 

                var samplingAreaNodeId = 'b3e171ac-1d9d-11eb-a29f-024e0d439fdb';  // Sampling Area (E22)
                var samplingActivitySamplingUnitTile = self.samplingActivitySamplingUnitCard().tiles().find(function(tile) {
                    var data = ko.unwrap(tile.data[samplingAreaNodeId]);

                    if (data) {
                        return ko.unwrap(data[0].resourceId) === selectedSampleLocationParentPhysicalThingResourceId;
                    }
                });

                if (samplingActivitySamplingUnitTile) {
                    var samplingAreaSampleCreatedNodeId = 'b3e171ab-1d9d-11eb-a29f-024e0d439fdb';  // Sample Created (E22)
                    var samplingAreaSampleCreatedParentPhysicalThingResourceId = ko.unwrap(samplingActivitySamplingUnitTile.data[samplingAreaSampleCreatedNodeId])[0].resourceId();

                    self.updateDescriptionWidgets(samplingAreaSampleCreatedParentPhysicalThingResourceId);
                }
            }
        };

        this.updateDescriptionWidgets = function(selectedSampleSamplingAreaSampleCreatedParentPhysicalThingResourceId) {
            var physicalThingStatementNodegroupId = '1952bb0a-b498-11e9-a679-a4d18cec433a';  // Statement (E33)
            
            if (selectedSampleSamplingAreaSampleCreatedParentPhysicalThingResourceId) {
                self.fetchCardFromResourceId(selectedSampleSamplingAreaSampleCreatedParentPhysicalThingResourceId, physicalThingStatementNodegroupId).then(function(samplingAreaSampleCreatedParentPhysicalThingStatementCard) {
                    var physicalThingStatementTypeNodeId = '1952e470-b498-11e9-b261-a4d18cec433a'; // Statement_type (E55)
                    var physicalThingStatementContentNodeId = '1953016e-b498-11e9-9445-a4d18cec433a';  // Statement_content (xsd:string)
    
                    var fooNodeId = "5f54a27c-111e-470f-a888-f18bfef32f25"; // TODO: refactor to use proper concept type
                    var sampleDescriptionTile = samplingAreaSampleCreatedParentPhysicalThingStatementCard.tiles().find(function(tile) {
                        return ko.unwrap(tile.data[physicalThingStatementTypeNodeId]).includes(fooNodeId);
                    });

    
                    if (sampleDescriptionTile) {
                        self.sampleDescriptionWidgetValue(ko.unwrap(sampleDescriptionTile.data[physicalThingStatementContentNodeId]));
                        self.previouslySavedSampleDescriptionWidgetValue(ko.unwrap(sampleDescriptionTile.data[physicalThingStatementContentNodeId]));
                    }
                    
                    var barNodeId = "8f86681e-cbdd-4cc5-9569-28b2171aebd7"; // TODO: refactor to use proper concept type
                    var motivationForSamplingTile = samplingAreaSampleCreatedParentPhysicalThingStatementCard.tiles().find(function(tile) {
                        return ko.unwrap(tile.data[physicalThingStatementTypeNodeId]).includes(barNodeId);
                    });
    
                    if (motivationForSamplingTile) {
                        self.motivationForSamplingWidgetValue(ko.unwrap(motivationForSamplingTile.data[physicalThingStatementContentNodeId]));
                        self.previouslySavedMotivationForSamplingWidgetValue(ko.unwrap(motivationForSamplingTile.data[physicalThingStatementContentNodeId]));
                    }
                });
            }
        };

        this.setPhysicalThingGeometriesToVisible = function(annotationNodes) {
            var physicalThingAnnotationNodeName = "Physical Thing - Part Identifier Assignment_Polygon Identifier";
            var physicalThingAnnotationNode = annotationNodes.find(function(annotationNode) {
                return annotationNode.name === physicalThingAnnotationNodeName;
            });
            physicalThingAnnotationNode.active(true); 
        };

        this.saveSampleLocationTile = function() {
            var savePhysicalThingNameTile = function(physicalThingNameTile) {
                return new Promise(function(resolve, _reject) {
                    var partIdentifierAssignmentLabelNodeId = '3e541cc6-859b-11ea-97eb-acde48001122';
                    var selectedSampleLocationInstanceLabel = ko.unwrap(self.selectedSampleLocationInstance().data[partIdentifierAssignmentLabelNodeId]);
                    
                    var physicalThingNameContentNodeId = 'b9c1d8a6-b497-11e9-876b-a4d18cec433a'; // Name_content (xsd:string)
                    physicalThingNameTile.data[physicalThingNameContentNodeId] = selectedSampleLocationInstanceLabel;
    
                    physicalThingNameTile.save().then(function(physicalThingNameData) {
                        resolve(physicalThingNameData);
                    });
                });
            };

            var savePhysicalThingPartOfTile = function(physicalThingPartOfTile) {
                var physicalThingPartOfNodeId = 'f8d5fe4c-b31d-11e9-9625-a4d18cec433a'; // part of (E22)

                return new Promise(function(resolve, _reject) {
                    physicalThingPartOfTile.data[physicalThingPartOfNodeId] = [{
                        "resourceId": self.physicalThingResourceId,
                        "ontologyProperty": "",
                        "inverseOntologyProperty": ""
                    }];

                    physicalThingPartOfTile.save().then(function(physicalThingPartOfData) {
                        resolve(physicalThingPartOfData);
                    });
                });
            };

            var saveSelectedSampleLocationInstance = function(physicalThingPartOfData) {
                return new Promise(function(resolve, _reject) {
                    /* assigns Physical Thing to be the Part Identifier on the parent selected Physical Thing  */ 
                    var physicalThingPartOfNodeId = 'f8d5fe4c-b31d-11e9-9625-a4d18cec433a'; // part of (E22)
                    var physicalThingPartOfResourceXResourceId = physicalThingPartOfData.data[physicalThingPartOfNodeId][0]['resourceXresourceId'];
                    
                    var selectedSampleLocationInstance = self.selectedSampleLocationInstance();
                    
                    var partIdentifierAssignmentPhysicalPartOfObjectNodeId = 'b240c366-8594-11ea-97eb-acde48001122';   
    
                    selectedSampleLocationInstance.data[partIdentifierAssignmentPhysicalPartOfObjectNodeId]([{
                        "resourceId": physicalThingPartOfData.resourceinstance_id,
                        "resourceXresourceId": physicalThingPartOfResourceXResourceId,
                        "ontologyProperty": "",
                        "inverseOntologyProperty": ""
                    }]);
    
                    selectedSampleLocationInstance.save().then(function(data) {
                        resolve(data);
                    });
                });
            };

            var getWorkingTile = function(card) {
                /* 
                    If an auto-generated resource has a tile with data, this will return it.
                    Otherwise it returns a new tile for the card.
                */ 

                var tile = null;
                
                /* Since this is an autogenerated resource, we can assume only one associated tile. */ 
                if (card.tiles() && card.tiles().length) {
                    tile = card.tiles()[0];
                }
                else {
                    tile = card.getNewTile();
                }

                return tile;
            };

            var getWorkingSamplingActivityUnitTile = function(samplingActivitySamplingUnitCard, regionPhysicalThingNameData) {
                var samplingAreaNodeId = 'b3e171ac-1d9d-11eb-a29f-024e0d439fdb';  // Sampling Area (E22)

                var samplingActivitySamplingUnitTile;
                if (samplingActivitySamplingUnitCard.tiles() && samplingActivitySamplingUnitCard.tiles().length) {
                    var previouslySavedTile = samplingActivitySamplingUnitCard.tiles().find(function(tile) {
                        var data = ko.unwrap(tile.data[samplingAreaNodeId]);

                        if (data) {
                            return ko.unwrap(data[0].resourceId) === regionPhysicalThingNameData.resourceinstance_id;
                        }
                    });

                    if (previouslySavedTile) {
                        samplingActivitySamplingUnitTile = previouslySavedTile;
                    }
                    else {
                        samplingActivitySamplingUnitTile = samplingActivitySamplingUnitCard.getNewTile();
                    }
                }
                else {
                    samplingActivitySamplingUnitTile = samplingActivitySamplingUnitCard.getNewTile();
                }

                return samplingActivitySamplingUnitTile;
            };

            var saveSamplingActivitySamplingUnitTile = function(samplingActivitySamplingUnitTile, regionPhysicalThingNameData, samplePhysicalThingNameData) {
                return new Promise(function(resolve, _reject) {
                    var samplingAreaNodeId = 'b3e171ac-1d9d-11eb-a29f-024e0d439fdb';  // Sampling Area (E22)
                    samplingActivitySamplingUnitTile.data[samplingAreaNodeId] = [{
                        "resourceId": regionPhysicalThingNameData.resourceinstance_id,
                        "ontologyProperty": "",
                        "inverseOntologyProperty": ""
                    }];

                    var samplingAreaOverallObjectSampledNodeId = 'b3e171aa-1d9d-11eb-a29f-024e0d439fdb';  //  Overall Object Sampled (E22)
                    samplingActivitySamplingUnitTile.data[samplingAreaOverallObjectSampledNodeId] = [{
                        "resourceId": self.physicalThingResourceId,
                        "ontologyProperty": "",
                        "inverseOntologyProperty": ""
                    }];

                    var samplingAreaSampleCreatedNodeId = 'b3e171ab-1d9d-11eb-a29f-024e0d439fdb';  // Sample Created (E22)
                    samplingActivitySamplingUnitTile.data[samplingAreaSampleCreatedNodeId] = [{
                        "resourceId": samplePhysicalThingNameData.resourceinstance_id,
                        "ontologyProperty": "",
                        "inverseOntologyProperty": ""
                    }];

                    var partIdentifierAssignmentPolygonIdentifierNodeId = "97c30c42-8594-11ea-97eb-acde48001122";  // Part Identifier Assignment_Polygon Identifier (E42)
                    var samplingAreaVisualizationNodeId = 'b3e171ae-1d9d-11eb-a29f-024e0d439fdb';  // Sampling Area Visualization (E42)

                    samplingActivitySamplingUnitTile.data[samplingAreaVisualizationNodeId] = ko.toJS(
                        self.physicalThingPartIdentifierAssignmentTile().data[partIdentifierAssignmentPolygonIdentifierNodeId]
                    );

                    samplingActivitySamplingUnitTile.save().then(function(data) {
                        resolve(data);
                    });
                });
            };

            var getRegionPhysicalThingNameCard = function() {
                return new Promise(function(resolve, _reject) {
                    var physicalThingNameNodegroupId = 'b9c1ced7-b497-11e9-a4da-a4d18cec433a';  // Name (E33)
                    var partIdentifierAssignmentPhysicalPartOfObjectNodeId = 'b240c366-8594-11ea-97eb-acde48001122';       
                    var partIdentifierAssignmentPhysicalPartOfObjectData = ko.unwrap(self.tile.data[partIdentifierAssignmentPhysicalPartOfObjectNodeId]);
        
                    if (partIdentifierAssignmentPhysicalPartOfObjectData) { /* if editing Physical Thing */
                        var partIdentifierAssignmentPhysicalPartOfObjectResourceId = partIdentifierAssignmentPhysicalPartOfObjectData[0]['resourceId']();
        
                        self.fetchCardFromResourceId(partIdentifierAssignmentPhysicalPartOfObjectResourceId, physicalThingNameNodegroupId).then(function(physicalThingNameCard) {
                            resolve(physicalThingNameCard);
                        });
                    }
                    else {
                        var physicalThingGraphId = '9519cb4f-b25b-11e9-8c7b-a4d18cec433a';
        
                        self.fetchCardFromGraphId(physicalThingGraphId, physicalThingNameNodegroupId).then(function(physicalThingNameCard) { 
                            resolve(physicalThingNameCard);
                        });
                    }

                });
            };

            var getSamplePhysicalThingNameCard = function(samplingActivitySamplingUnitTile) {
                return new Promise(function(resolve, _reject) {
                    var samplingUnitSampleCreatedNodeId = 'b3e171ab-1d9d-11eb-a29f-024e0d439fdb';  // Sample Created (E22)
                    var samplingUnitSampleCreatedData = ko.unwrap(samplingActivitySamplingUnitTile.data[samplingUnitSampleCreatedNodeId]);
    
                    var physicalThingNameNodegroupId = 'b9c1ced7-b497-11e9-a4da-a4d18cec433a';  // Name (E33)

                    if (samplingUnitSampleCreatedData) {
                        /* name card of physical thing representing sample */ 
                        self.fetchCardFromResourceId(samplingUnitSampleCreatedData[0].resourceId(), physicalThingNameNodegroupId).then(function(samplingUnitSampleCreatedCard) {
                            resolve(samplingUnitSampleCreatedCard);
                        });
                    }
                    else {
                        var physicalThingGraphId = '9519cb4f-b25b-11e9-8c7b-a4d18cec433a';
    
                        self.fetchCardFromGraphId(physicalThingGraphId, physicalThingNameNodegroupId).then(function(samplingUnitSampleCreatedCard) { 
                            resolve(samplingUnitSampleCreatedCard);
                        });
                    }
                });              
            };

            var getWorkingPhysicalThingStatementTile = function(physicalThingStatementCard, conceptTypeId) {
                if (physicalThingStatementCard.tiles() && physicalThingStatementCard.tiles().length) {
                    var physicalThingStatementTypeNodeId = '1952e470-b498-11e9-b261-a4d18cec433a'; // Statement_type (E55)

                    var previouslySavedTile = physicalThingStatementCard.tiles().find(function(tile) {
                        return ko.unwrap(tile.data[physicalThingStatementTypeNodeId]).includes(conceptTypeId);
                    });

                    if (previouslySavedTile) {
                        return previouslySavedTile;
                    }
                    else {
                        return physicalThingStatementCard.getNewTile();
                    }
                }
                else {
                    return physicalThingStatementCard.getNewTile();
                }
            };

            var savePhysicalThingSampleDescriptionStatementTile = function(physicalThingStatementTile) {
                var fooNodeId = "5f54a27c-111e-470f-a888-f18bfef32f25"; // TODO: refactor to use proper concept type

                return new Promise(function(resolve, _reject) {
                    if (self.sampleDescriptionWidgetValue()) {
                        /* statment content logic */ 
                        var physicalThingStatementContentNodeId = '1953016e-b498-11e9-9445-a4d18cec433a';  // Statement_content (xsd:string)
                        physicalThingStatementTile.data[physicalThingStatementContentNodeId] = self.sampleDescriptionWidgetValue();
    
                        /* statement type logic */ 
                        var physicalThingStatementTypeNodeId = '1952e470-b498-11e9-b261-a4d18cec433a'; // Statement_type (E55)
    
                        var physicalThingStatementTypeData = ko.unwrap(physicalThingStatementTile.data[physicalThingStatementTypeNodeId]);
    
                        if (!physicalThingStatementTypeData.includes(fooNodeId)) {
                            physicalThingStatementTypeData.push(fooNodeId);
                        }
    
                        physicalThingStatementTile.data[physicalThingStatementTypeNodeId] = physicalThingStatementTypeData;
    
                        physicalThingStatementTile.save().then(function(data) {
                            resolve(data);
                        });
                    }
                    else {
                        resolve(null);
                    }
                });
            };

            var savePhysicalThingMotivationForSamplingStatementTile = function(physicalThingStatementTile) {
                var barNodeId = "8f86681e-cbdd-4cc5-9569-28b2171aebd7"; // TODO: refactor to use proper concept type

                
                return new Promise(function(resolve, _reject) {
                    if (self.motivationForSamplingWidgetValue()) {
                        /* statment content logic */ 
                        var physicalThingStatementContentNodeId = '1953016e-b498-11e9-9445-a4d18cec433a';  // Statement_content (xsd:string)
                        physicalThingStatementTile.data[physicalThingStatementContentNodeId] = self.motivationForSamplingWidgetValue();
    
                        /* statement type logic */ 
                        var physicalThingStatementTypeNodeId = '1952e470-b498-11e9-b261-a4d18cec433a'; // Statement_type (E55)
    
                        var physicalThingStatementTypeData = ko.unwrap(physicalThingStatementTile.data[physicalThingStatementTypeNodeId]);
                        if (!physicalThingStatementTypeData.includes(barNodeId)) {
                            physicalThingStatementTypeData.push(barNodeId);
                        }
                        
                        /* edge case where card persists selection as default */ 
                        var fooNodeId = "5f54a27c-111e-470f-a888-f18bfef32f25"; // TODO: refactor to use proper concept type
                        physicalThingStatementTile.data[physicalThingStatementTypeNodeId] = physicalThingStatementTypeData.filter(function(data) {
                            return data !== fooNodeId;
                        });
    
                        physicalThingStatementTile.save().then(function(data) {
                            resolve(data);
                        });
                    }
                    else {
                        resolve(null);
                    }
                });
            };

            self.savingTile(true);
            getRegionPhysicalThingNameCard().then(function(regionPhysicalThingNameCard) {
                var regionPhysicalThingNameTile = getWorkingTile(regionPhysicalThingNameCard);

                savePhysicalThingNameTile(regionPhysicalThingNameTile).then(function(regionPhysicalThingNameData) {
                    var physicalThingPartOfNodeId = 'f8d5fe4c-b31d-11e9-9625-a4d18cec433a'; // part of (E22)

                    self.fetchCardFromResourceId(regionPhysicalThingNameData.resourceinstance_id, physicalThingPartOfNodeId).then(function(regionPhysicalThingPartOfCard) {
                        var physicalThingPartOfTile = getWorkingTile(regionPhysicalThingPartOfCard);

                        savePhysicalThingPartOfTile(physicalThingPartOfTile).then(function(regionPhysicalThingPartOfData) {
                            var samplingUnitNodegroupId = 'b3e171a7-1d9d-11eb-a29f-024e0d439fdb';  // Sampling Unit (E80)
                
                            self.fetchCardFromResourceId(self.samplingActivityResourceId, samplingUnitNodegroupId).then(function(samplingActivitySamplingUnitCard) {
                                var samplingActivitySamplingUnitTile = getWorkingSamplingActivityUnitTile(samplingActivitySamplingUnitCard, regionPhysicalThingNameData);
            
                                getSamplePhysicalThingNameCard(samplingActivitySamplingUnitTile).then(function(samplePhysicalThingNameCard) {
                                    var samplePhysicalThingNameTile = getWorkingTile(samplePhysicalThingNameCard);

                                    savePhysicalThingNameTile(samplePhysicalThingNameTile).then(function(samplePhysicalThingNameData) {
                                        var physicalThingStatementNodegroupId = '1952bb0a-b498-11e9-a679-a4d18cec433a';  // Statement (E33)
                                        
                                        self.fetchCardFromResourceId(samplePhysicalThingNameData.resourceinstance_id, physicalThingStatementNodegroupId).then(function(physicalThingStatementCard) {
                                            var fooNodeId = "5f54a27c-111e-470f-a888-f18bfef32f25"; // TODO: refactor to use proper concept type
                                            var physicalThingSampleDescriptionStatementTile = getWorkingPhysicalThingStatementTile(physicalThingStatementCard, fooNodeId);

                                            savePhysicalThingSampleDescriptionStatementTile(physicalThingSampleDescriptionStatementTile).then(function(_physicalThingStatmentSampleDescriptionData) {
                                                var barNodeId = "8f86681e-cbdd-4cc5-9569-28b2171aebd7"; // TODO: refactor to use proper concept type
                                                var physicalThingMotivationForSamplingStatementTile = getWorkingPhysicalThingStatementTile(physicalThingStatementCard, barNodeId);

                                                savePhysicalThingMotivationForSamplingStatementTile(physicalThingMotivationForSamplingStatementTile).then(function(_physicalThingMotivationForSamplingStatementData){
                                                    saveSamplingActivitySamplingUnitTile(samplingActivitySamplingUnitTile, regionPhysicalThingNameData, samplePhysicalThingNameData).then(function(_samplingActivitySamplingUnitData) {
                                                        saveSelectedSampleLocationInstance(regionPhysicalThingPartOfData).then(function(_selectedSampleLocationInstanceData) {
                                                            self.fetchCardFromResourceId(self.samplingActivityResourceId, samplingUnitNodegroupId).then(function(samplingActivitySamplingUnitCard) {
                                                                self.samplingActivitySamplingUnitCard(samplingActivitySamplingUnitCard);

                                                                self.sampleLocationInstances(self.card.tiles());
                                                                self.selectSampleLocationInstance(self.selectedSampleLocationInstance());
    
                                                                self.savingTile(false);
                                                            });
                                                            
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        };

        this.loadNewSampleLocationTile = function() {
            var newTile = self.card.getNewTile(true);  /* true flag forces new tile generation */
            self.selectSampleLocationInstance(newTile);
        };

        this.saveWorkflowStep = function() {
            params.form.complete(false);
            params.form.saving(true);
            let mappedInstances = self.sampleLocationInstances().map((instance) => { return { "data": instance.data }});
            params.form.savedData(mappedInstances);
            params.form.complete(true);
            params.form.saving(false);
        };

        this.loadExternalCardData = function(data) {
            var partIdentifierAssignmentNodeGroupId = 'fec59582-8593-11ea-97eb-acde48001122';  // Part Identifier Assignment (E13) 

            var partIdentifierAssignmentCardData = data.cards.find(function(card) {
                return card.nodegroup_id === partIdentifierAssignmentNodeGroupId;
            });

            var handlers = {
                'after-update': [],
                'tile-reset': []
            };

            var graphModel = new GraphModel({
                data: {
                    nodes: data.nodes,
                    nodegroups: data.nodegroups,
                    edges: []
                },
                datatypes: data.datatypes
            });

            var partIdentifierAssignmentCard = new CardViewModel({
                card: partIdentifierAssignmentCardData,
                graphModel: graphModel,
                tile: null,
                resourceId: ko.observable(self.physicalThingResourceId),
                displayname: ko.observable(data.displayname),
                handlers: handlers,
                cards: data.cards,
                tiles: data.tiles,
                cardwidgets: data.cardwidgets,
                userisreviewer: data.userisreviewer,
            });

            var card = partIdentifierAssignmentCard;
            var tile = partIdentifierAssignmentCard.getNewTile();

            self.card = card;
            self.tile = tile;

            params.card = self.card;
            params.tile = self.tile;
            
            var partIdentifierAssignmentPolygonIdentifierNodeId = "97c30c42-8594-11ea-97eb-acde48001122";  // Part Identifier Assignment_Polygon Identifier (E42)
            params.widgets = self.card.widgets().filter(function(widget) {
                return widget.node_id() === partIdentifierAssignmentPolygonIdentifierNodeId;
            });

            self.physicalThingPartIdentifierAssignmentCard(card);
            self.physicalThingPartIdentifierAssignmentTile(tile);

            self.sampleLocationInstances(card.tiles());

            /* 
                subscription to features lives here because we _only_ want it to run once, on blank starting tile, when a user places a feature on the map
            */
            var tileFeatureGeometrySubscription = tile.data[partIdentifierAssignmentPolygonIdentifierNodeId].subscribe(function(data) {
                if (data) {
                    self.selectSampleLocationInstance(tile);
                    tileFeatureGeometrySubscription.dispose();
                }
            });

            self.hasExternalCardData(true);
        };

        this.handleExternalCardData = function() {
            var partIdentifierAssignmentLabelNodeId = '3e541cc6-859b-11ea-97eb-acde48001122';
            self.partIdentifierAssignmentLabelWidget(self.card.widgets().find(function(widget) {
                return ko.unwrap(widget.node_id) === partIdentifierAssignmentLabelNodeId;
            }));

            var partIdentifierAssignmentPolygonIdentifierNodeId = '97c30c42-8594-11ea-97eb-acde48001122';
            self.partIdentifierAssignmentPolygonIdentifierWidget(self.card.widgets().find(function(widget) {
                return ko.unwrap(widget.node_id) === partIdentifierAssignmentPolygonIdentifierNodeId;
            }));                
            
            IIIFAnnotationViewmodel.apply(self, [{
                ...params,
                onEachFeature: function(feature, layer) {
                    layer.on({
                        click: function() {
                            var sampleLocationInstance = self.getSampleLocationTileFromFeatureId(feature.id);

                            if (!self.selectedSampleLocationInstance() || self.selectedSampleLocationInstance().tileid !== sampleLocationInstance.tileid ) {
                                self.selectSampleLocationInstance(sampleLocationInstance);
                            }
                            else if (self.selectedSampleLocationInstance() && self.selectedSampleLocationInstance().tileid === sampleLocationInstance.tileid) {
                                // self.editFeature(ko.toJS(feature));
                                console.log(self, params)
                                console.log("dbl click")
                            }
                        },
                    })
                }
            }]);

            /* overwrites iiif-annotation method */ 
            self.updateTiles = function() {
                _.each(self.featureLookup, function(value) {
                    value.selectedTool(null);
                });

                var partIdentifierAssignmentPolygonIdentifierNodeId = "97c30c42-8594-11ea-97eb-acde48001122";  // Part Identifier Assignment_Polygon Identifier (E42)

                var tileFeatures = ko.toJS(self.tile.data[partIdentifierAssignmentPolygonIdentifierNodeId].features);

                if (tileFeatures) {
                    var featuresNotInTile = self.drawFeatures().filter(function(drawFeature) {
                        return !tileFeatures.find(function(tileFeature) {
                            return tileFeature.id === drawFeature.id;
                        });
                    });

                    self.tile.data[partIdentifierAssignmentPolygonIdentifierNodeId].features([...tileFeatures, ...featuresNotInTile]);
                }
                else {
                    self.widgets.forEach(function(widget) {
                        var id = ko.unwrap(widget.node_id);
                        var features = [];
                        self.drawFeatures().forEach(function(feature){
                            if (feature.properties.nodeId === id) {
                                features.push(feature);
                            }
                        });
                        if (ko.isObservable(self.tile.data[id])) {
                            self.tile.data[id]({
                                type: 'FeatureCollection',
                                features: features
                            });
                        } 
                        else {
                            self.tile.data[id].features(features);
                        }
                    });
                }
            };
        };

        this.fetchCardFromResourceId = function(resourceId, nodegroupId) {
            return new Promise(function(resolve, _reject) {
                self._fetchCard(resourceId, null, nodegroupId).then(function(data) {
                    resolve(data);
                });
            });
        };

        this.fetchCardFromGraphId = function(graphId, nodegroupId) {
            return new Promise(function(resolve, _reject) {
                self._fetchCard(null, graphId, nodegroupId).then(function(data) {
                    resolve(data);
                });
            });
        };

        this._fetchCard = function(resourceId, graphId, nodegroupId) {
            return new Promise(function(resolve, _reject) {
                $.getJSON( arches.urls.api_card + ( resourceId || graphId ) ).then(function(data) {
                    var cardData = data.cards.find(function(card) {
                        return card.nodegroup_id === nodegroupId;
                    });

                    var handlers = {
                        'after-update': [],
                        'tile-reset': []
                    };
        
                    var graphModel = new GraphModel({
                        data: {
                            nodes: data.nodes,
                            nodegroups: data.nodegroups,
                            edges: []
                        },
                        datatypes: data.datatypes
                    });

                    resolve(new CardViewModel({
                        card: cardData,
                        graphModel: graphModel,
                        tile: null,
                        resourceId: ko.observable(ko.unwrap(resourceId)),
                        displayname: ko.observable(data.displayname),
                        handlers: handlers,
                        cards: data.cards,
                        tiles: data.tiles,
                        cardwidgets: data.cardwidgets,
                        userisreviewer: data.userisreviewer,
                    }));

                });
            });
        };

        ko.bindingHandlers.scrollTo = {
            update: function (element, valueAccessor) {
                var _value = valueAccessor();
                var _valueUnwrapped = ko.unwrap(_value);
                if (_valueUnwrapped) {
                    element.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
                }
            }
        };

        this.initialize();
    };

    ko.components.register('sample-taking-sample-location-step', {
        viewModel: viewModel,
        template: { require: 'text!templates/views/components/workflows/sample-taking-workflow/sample-taking-sample-location-step.htm' }
    });
    return viewModel;
});