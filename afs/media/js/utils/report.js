define([
    'arches'
], function(arches) {
    const standardizeNode = (obj) => {
        if(obj){
            const keys = Object.keys(obj);
            keys.forEach(x => {
                obj[x.toLowerCase().trim()] = obj[x];
            });
        }
    };

    const getRawNodeValue = (resource, ...args) => {
        let node = resource;
        for(let i = 0; i < args.length; ++i){
            standardizeNode(node);
            const arg = args[i];
            node = node?.[arg];
        }
        return node;
    };

    const processRawNodeValue = (rawValue) => {
        const nodeValue = rawValue?.["@display_value"]
        const geojson = rawValue?.geojson;
        if(geojson){
            return geojson;
        }
        if(nodeValue){
            return $(`<span>${nodeValue}</span>`).text();
        } else {
            return "--";
        }
    };

    return {
        // default table configuration - used for display
        defaultTableConfig: {
            responsive: {
                breakpoints: [
                    {name: 'bigdesktop', width: Infinity},
                    {name: 'meddesktop', width: 1480},
                    {name: 'smalldesktop', width: 1280},
                    {name: 'medium', width: 1188},
                    {name: 'tabletl', width: 1024},
                    {name: 'btwtabllandp', width: 848},
                    {name: 'tabletp', width: 768},
                    {name: 'mobilel', width: 480},
                    {name: 'mobilep', width: 320}
                ]
            },
            paging: false,
            searching: false,
            scrollCollapse: true,
            info: false,
            columnDefs: [{
                orderable: false,
                targets: -1
            }],
        },

        // used to collapse sections within a tab
        toggleVisibility: (observable) => { observable(!observable()) },

        // Functions used for interacting with card tree
        deleteTile: (tileid, card) => {
            const tile = card.tiles().find(y => tileid == y.tileid)
            if(tile){
                tile.deleteTile((err) => { 
                    console.log(err); 
                }, () => {});
            }
        },

        editTile: function(tileid, card){
            if(card){
                const tile = card.tiles().find(y => tileid == y.tileid)
                if(tile){
                    tile.selected(true);
                }
            }
        },

        // Used to add a new tile object to a given card.  If nested card, saves the parent tile for the
        // card and uses the same card underneath the parent tile.
        addNewTile: async (card) => {
            let currentCard = card;
            if(card.parentCard && !card.parent?.tileid){
                await card.parentCard.saveParentTile();
                currentCard = card.parentCard.tiles()?.[0].cards.find(x => x.nodegroupid == card.nodegroupid)
            }
            currentCard.canAdd() ? currentCard.selected(true) : currentCard.tiles()[0].selected(true);
            if(currentCard.cardinality == "n" || (currentCard.cardinality == "1" && !currentCard.tiles().length)) {
                const currentSubscription = currentCard.selected.subscribe(function(){
                    currentCard.showForm(true);
                    currentSubscription.dispose();
                });
            }
        },

        // builds an object-based dictionary for cards
        createCardDictionary: (cards) => {
            const dictionary = {};
            for(card of cards){
                dictionary[card.model.name()] = card;
            }
            return dictionary;
        },

        // extract a value from a resource graph given a specific path (args)
        getRawNodeValue: getRawNodeValue,

        processRawValue: processRawNodeValue,

        getResourceLink: (node) => {
            const resourceId = node.resourceId;
            if(resourceId){
                return `${arches.urls.resource}\\${resourceId}`;
            }
        },

        getNodeValue: (resource, ...args) => {
            const rawValue = getRawNodeValue(resource, args);
            return processRawNodeValue(rawValue);
        }
    } 
});
