define([
    'knockout',
    'jquery',
    'arches',
    'viewmodels/workflow',
    'viewmodels/alert',
    'views/components/workflows/xrf-upload-workflow/dataset-step',
], function(ko, $, arches, Workflow, AlertViewModel) {
    return ko.components.register('xrf-upload-workflow', {
        viewModel: function(params) {
            this.componentName = 'xrf-upload-workflow';

            this.stepConfig = [
                {
                    title: 'Dataset Type',
                    name: 'dataset-step', /* unique to workflow */
                    required: true,
                    layoutSections: [
                        {
                            sectionTitle: 'Dataset Type',
                            componentConfigs: [
                                { 
                                    componentName: 'dataset-step',
                                    uniqueInstanceName: 'dataset-step', /* unique to step */
                                    tilesManaged: 'none',
                                    parameters: {},
                                },
                            ], 
                        },
                    ],
                    stepInjectionConfig: {
                        defaultStepChoice: null,  /* optional param to show tab on new workflow creation */ 
                        stepNameToInjectAfter: function(_step) {  /* step = self-introspection */ 
                            return 'select-instrument-and-files';
                        },
                        injectionLogic: function(step) {  /* step = self-introspection */ 
                            if (
                                step.workflowComponentAbstractLookup() 
                                && step.workflowComponentAbstractLookup()['dataset-step'].savedData() === 'non-destructive'
                            ) {
                                return sampleLocationStep;
                            }
                            if (step.workflowComponentAbstractLookup() && step.workflowComponentAbstractLookup()['dataset-step'].savedData() === 'destructive') {
                                return uploadDatasetStep;
                            }
                        }
                    },
                }
            ];

            Workflow.apply(this, [params]);

            this.reverseWorkflowTransactions = function() {
                const quitUrl = this.quitUrl;
                return $.ajax({
                    type: "POST",
                    url: arches.urls.transaction_reverse(this.id())
                }).then(function() {
                    params.loading(false);
                    window.location.href = quitUrl;
                });
            };

            this.quitWorkflow = function(){
                this.alert(
                    new AlertViewModel(
                        'ep-alert-red',
                        'Are you sure you would like to delete this workflow?',
                        'All data created during the course of this workflow will be deleted.',
                        function(){}, //does nothing when canceled
                        () => {
                            params.loading('Cleaning up...')
                            this.reverseWorkflowTransactions()
                        },
                    )
                );
            };
        },
        template: { require: 'text!templates/views/components/plugins/xrf-upload-workflow.htm' }
    });
});
