define([
    'knockout',
    'jquery',
    'arches',
    'viewmodels/workflow',
], function(ko, $, arches, Workflow) {
    return ko.components.register('project-report-workflow', {
        viewModel: function(params) {
            this.componentName = 'project-report-workflow';
            
            this.stepConfig = [
                {
                    title: 'Select Project',
                    name: 'select-project',  /* unique to workflow */
                    required: true,
                    informationboxdata: {
                        heading: 'Select Project',
                        text: 'Select a project to update',
                    },
                    layoutSections: [
                        {
                            sectionTitle: 'Select Project',
                            componentConfigs: [
                                {
                                    componentName: 'resource-instance-select-widget',
                                    uniqueInstanceName: 'select-project', /* unique to step */
                                    parameters: {
                                        graphids: [
                                            '0b9235d9-ca85-11e9-9fa2-a4d18cec433a'/* Project */
                                        ],
                                    },
                                },
                            ], 
                        },
                    ],
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

            this.quitUrl = arches.urls.plugin('init-workflow');
        },
        template: { require: 'text!templates/views/components/plugins/project-report-workflow.htm' }
    });
});