define(['underscore', 'knockout', 'arches', 'utils/report','bindings/datatable'], function(_, ko, arches, reportUtils) {
    return ko.components.register('views/components/reports/scenes/name', {
        viewModel: function(params) {
            var self = this;
            Object.assign(self, reportUtils);

            self.nameTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(6).fill(null)
            };

            self.identifierTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(5).fill(null)
            };

            self.dataConfig = {
                name: 'Name',
                identifier: 'Identifier',
                exactMatch: 'exactmatch',
                type: 'type'
            }

            self.cards = Object.assign({}, params.cards);
            self.edit = params.editTile || self.editTile;
            self.delete = params.deleteTile || self.deleteTile;
            self.add = params.addTile || self.addNewTile;
            self.names = ko.observableArray();
            self.identifiers = ko.observableArray();
            self.exactMatch = ko.observable();
            self.type = ko.observable();
            self.visible = {
                names: ko.observable(true),
                identifiers: ko.observable(true),
                classifications: ko.observable(true)
            }
            Object.assign(self.dataConfig, params.dataConfig || {});

            // if params.compiled is set and true, the user has compiled their own data.  Use as is.
            if(params?.compiled){
                self.names(params.data.names);
                self.identifiers(params.data.identifiers);
                self.exactMatch(params.data.exactMatch);
                self.type(params.data.type);
            } else {
                let nameData = params.data()[self.dataConfig.name];
                if(nameData.length === undefined){
                    nameData = [nameData]
                } 

                self.names(nameData.map(x => {
                    const type = self.getNodeValue(x, `${self.dataConfig.name}_type`);
                    const content = self.getNodeValue(x, `${self.dataConfig.name}_content`);
                    const language = self.getNodeValue(x, `${self.dataConfig.name}_language`);
                    const label = self.getNodeValue(x, `${self.dataConfig.name}_label`);
                    const source = self.getNodeValue(x, `${self.dataConfig.name}_source`);
                    const tileid = x?.['@tile_id'];
                    return { type, content, language, label, source, tileid }
                }));

                let identifierData = params.data()[self.dataConfig.identifier];
                if(identifierData.length === undefined){
                    identifierData = [identifierData]
                } 

                if(identifierData) {
                    self.identifiers(identifierData.map(x => {
                        const type = self.getNodeValue(x, "identifier_type");
                        const content = self.getNodeValue(x, "identifier_content");
                        const label = self.getNodeValue(x, "identifier_label");
                        const source = self.getNodeValue(x, "identifier_source");
                        const tileid = x?.['@tile_id'];
                        return { type, content, label, source, tileid }
                    }));
                }

                if(self.dataConfig.exactMatch){
                    self.exactMatch(self.getNodeValue(params.data(), self.dataConfig.exactMatch));
                }
                self.type(self.getNodeValue(params.data(), self.dataConfig.type));
            } 

        },
        template: { require: 'text!templates/views/components/reports/scenes/name.htm' }
    });
});