const DEV = false // false or comment to turn off

const baseV1 = DEV ? "https://devstore.rerum.io/" : "https://store.rerum.io/"
const tiny = DEV ? "https://tinydev.rerum.io/app/" : "https://tinypaul.rerum.io/dla/"

export default {
    ID: "deer-id", // attribute, URI for resource to render
    TYPE: "deer-type", // attribute, JSON-LD @type
    TEMPLATE: "deer-template", // attribute, enum for custom template
    KEY: "deer-key", // attribute, key to use for annotation
    LABEL: "title", // attribute, alternate label for properties
    CONTEXT: "deer-context", // attribute, JSON-LD @context, scoped
    ATTRIBUTION: "deer-creator", // attribute, Web Annotation `creator`, scoped
    MOTIVATION: "deer-motivation", // attribute, Web Annotation `motivation`, scoped
    LIST: "deer-list", // attribute, property with resource array
    COLLECTION: "deer-collection", // attribute, name of aggregating collection
    LISTENING: "deer-listening", // attribute, name of container to watch for clicks
    LINK: "deer-link", // attribute, location of href#[deer-id] for <a>s
    VIEW: "deer-view, .deer-view", // selector, identifies render containers
    FORM: "form[deer-type]", // selector, identifies data entry containers
    ITEMTYPE: "deer-item-type", //attribute, specialty forms ('entity' by default)
    SOURCE: "deer-source", // attribute, URI for asserting annotation
    EVIDENCE: "nv-evidence", // attribute, URI for supporting evidence
    INPUTTYPE: "deer-input-type", //attribute, defines whether this is an array list, array set, or object 
    ARRAYDELIMETER: "deer-array-delimeter", //attribute, denotes delimeter to use for array.join()

    INPUTS: ["input", "textarea", "dataset", "select"], // array of selectors, identifies inputs with .value
    CONTAINERS: ["ItemList", "ItemListElement", "List", "Set", "list", "set", "@list", "@set"], // array of supported list and set types the app will dig into for array values
    PRIMITIVES: [],

    URLS: {
        BASE_ID: baseV1,
        CREATE: tiny + "create",
        UPDATE: tiny + "update",
        OVERWRITE: tiny + "overwrite",
        QUERY: tiny + "query",
        SINCE: baseV1 + "since"
    },

    EVENTS: {
        CREATED: "deer-created",
        UPDATED: "deer-updated",
        LOADED: "deer-loaded",
        NEW_VIEW: "deer-view",
        NEW_FORM: "deer-form",
        VIEW_RENDERED: "deer-view-rendered",
        FORM_RENDERED: "deer-form-rendered",
        CLICKED: "deer-clicked"
    },

    SUPPRESS: ["__rerum", "@context"], //properties to ignore
    DELIMETERDEFAULT: ",", //Default delimeter for .split()ing and .join()ing 
    ROBUSTFEEDBACK: true, //Show warnings along with errors in the web console.  Set to false to only see errors.  

    /**
     * Add any custom templates here through import or copy paste.
     * Templates added here will overwrite the defaults in deer-render.js.
     * 
     * Each property must be lower-cased and return a template literal
     * or an HTML String.
     */
    TEMPLATES: {
        cat: (obj) => `<h5>${obj.name}</h5><img src="https://placekitten.com/300/150" style="width:100%;">`,
        metadataLetter: obj => `
            <p>Letter between Paul and Alice, sent ${obj.date?.value ?? obj.date ?? '<span class="alert">⚠ NO DATE SET ⚠</span>'}
            from ${obj.fromLocation?.value ?? obj.fromLocation ?? '<span class="alert">⚠ NO CITY WHENCE ⚠</span>'} to 
            ${obj.toLocation?.value ?? obj.toLocation ?? '<span class="alert">⚠ NO CITY WHITHER ⚠</span>'}.</p>
            <dl class="metadata">
                <dt> Record Label </dt>
                <dd> ${ obj.label?.value ?? obj.label ?? '<span class="alert">⚠ Missing label</span>' }</dd>
                <dt> URI </dt>
                <dd> ${ obj['@id'] ?? obj.id }</dd>
                <dt> type </dt>
                <dd> ${ obj['@type'] ?? obj.type }</dd>
                <dt> Collection </dt>
                <dd> ${ obj.targetCollection?.value }</dd>
                <dt> Transcription project ID </dt>
                <dd> ${ obj.tpenProject?.[0].value ?? obj.tpenProject?.value ?? obj.tpenProject ?? '<span class="alert">⚠ No connected project</span>'}</dd>
                <dt> Record creator </dt>
                <dd> <deer-view deer-id="${ obj.creator?.value ?? obj.creator }" deer-template="label">${ obj.creator?.value ?? obj.creator }</deer-view></dd>
            </dl>
            <deer-view id="previewTranscription" deer-template="folioTranscription" deer-id="${obj['@id']}"></deer-view>
        `,
        metadataPoem: obj => this.TEMPLATES.entity,
        preview: obj => {
            let templateDetail = "json"
            let templateLink = "#"
            switch (obj.targetCollection?.value) {
                case "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar": 
                    templateDetail = "metadataLetter"
                    templateLink = `https://dunbar-letters.rerum.io/ms.html#${obj['@id']}`
                    break
                case "DLA Poems Collection": 
                    templateDetail = "metadataPoem"
                    templateLink = `https://dunbar-poems.rerum.io/poem.html#${obj['@id']}`
                    break
                default: "entity"

            }
            return `
            <div>
                <a href="${templateLink}" target="_blank">Modify Description</a>
                <deer-view deer-template="${templateDetail}" deer-id="${obj['@id']}"></deer-view>
            </div>
        `},
        /**
 * Retreive the best label for object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
        label: function (obj, options = {}) {
            let key = options.key || "@id"
            let prop = obj[key] || "[ undefined ]"
            let label = options.label || UTILS.getLabel(obj, prop)
            try {
                return `${label}`
            } catch (err) {
                return null
            }
        },

        /**
         * Retreive the best label for object and return it formatted as HTML to be drawn.  
         * @param {Object} obj some obj to be labeled
         * @param {Object} options for lookup
         */
        linky: function (obj, options = {}) {
            try {
                let link = obj[options.key]
                return link ? `<a href="${UTILS.getValue(link)}" title="Open in a new window" target="_blank"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAQElEQVR42qXKwQkAIAxDUUdxtO6/RBQkQZvSi8I/pL4BoGw/XPkh4XigPmsUgh0626AjRsgxHTkUThsG2T/sIlzdTsp52kSS1wAAAABJRU5ErkJggg=="></a>` : ``
            } catch (err) {
                return null
            }
        },

        folioTranscription : function (obj, options = {}) {
            return {
                html: obj.tpenProject ? `<div class="is-full-width"> <h3> ... loading preview ... </h3> </div>` : ``,
                then: (elem) => {
                    const proj = obj.tpenProject?.value ?? obj.tpenProject?.pop()?.value ?? obj.tpenProject?.pop() ?? obj.tpenProject
                    if (!proj) {
                        elem.innerHTML = `[ no project linked yet ]`
                        return
                    }
                    fetch("https://t-pen.org/TPEN/manifest/" + proj)
                    .then(response => response.json())
                    .then(ms => {
                            const pages = ms.sequences[0].canvases.slice(0, 10).reduce((a, b) => a += `
                            <div class="page">
                                <h3>${b.label}</h3>
                                <div class="pull-right col-6">
                                    <img src="${b.images[0].resource['@id'].replace(/^https?:/,'')}">
                                </div>
                                <div>
                                    ${b.otherContent[0].resources.reduce((aa, bb) => aa +=
                                bb.resource["cnt:chars"].length
                                    ? bb.resource["cnt:chars"].slice(-1) == '-'
                                        ? bb.resource["cnt:chars"].substring(0, bb.resource["cnt:chars"].length - 1)
                                        : bb.resource["cnt:chars"] + ' '
                                    : " <line class='empty col-6'></line> ", '')
                                }
                                </div>
                            </div>
                            `, ``)
                            
                            elem.innerHTML = `
                        <style>
                            printed {
                                font-family:serif;
                            }
                            note {
                                font-family:monospace;
                            }
                            unclear {
                                opacity:.4;
                            }
                            line.empty {
                                line-height: 1.6;
                                background-color: #CCC;
                                height: 1em;
                                margin: .4em 0;
                                display:block;
                                border-radius: 4px;
                            }
                            .page {
                                clear:both;
                            }
                            .page img {
                                margin: 0 1em 1em 0;
                                float:left;
                            }
                        </style>
                        <a href="https://t-pen.org/TPEN/transcription.html?projectID=${parseInt(ms['@id'].split("manifest/")?.[1])}" target="_blank">transcribe on TPEN</a>
                        <h2>${ms.label}</h2>
                        ${pages}
                `})
                }
            }
        }
        ,
        msList: function (obj, options = {}) {
            let tmpl = `<h2>Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar (${obj?.[options?.list].length ?? " empty "})</h2>`
            if (options.list) {
                tmpl += `<ul>`
                obj[options.list].forEach((val, index) => {
                    val['@id'] = val['@id'].replace('http:','https:')
                    tmpl += `<li><a href="${options.link}${val['@id']}"><deer-view deer-id="${val["@id"]}" deer-template="label">${val.label}</deer-view></a></li>`
                })
                tmpl += `</ul>`
            }
            return tmpl
        },
        managedlist: (obj, options = {}) => {
            try {
                let tmpl = `<input type="hidden" deer-collection="${options.collection}">`
                if (options.list) {
                    tmpl += `<ul>`
                    obj[options.list].forEach((val, index) => {
                        const removeBtn = `<a href="${val['@id']}" class="removeCollectionItem" title="Delete This Entry">&#x274C</a>`
                        const onlistBtn = `<a class="togglePublic project" href="${val['@id']}" title="Toggle project inclusion"> &plus; </a>`
                        const visibilityBtn = `<a class="togglePublic released" href="${val['@id']}" title="Toggle public visibility"> 👁 </a>`
                        tmpl += `<li>
                        ${onlistBtn}
                        ${visibilityBtn}
                        <a href="${options.link}${val['@id']}">
                            <deer-view deer-id="${val["@id"]}" deer-template="label">${index + 1}</deer-view>
                        </a>
                        ${removeBtn}
                        </li>`
                    })
                    tmpl += `</ul>`
                }
                else {
                    console.log("There are no items in this list to draw.")
                    console.log(obj)
                }
                return {
                    html: tmpl,
                    then: elem => {

                        fetch(elem.getAttribute("deer-listing")).then(r => r.json())
                            .then(list => {
                                elem.projectCache = new Set()
                                list.itemListElement?.forEach(item => elem.projectCache.add(item['@id']))
                                for (const a of document.querySelectorAll('.togglePublic.project')) {
                                    const include = elem.projectCache.has(a.getAttribute("href")) ? "add" : "remove"
                                    a.classList[include]("is-included")
                                }
                            })
                            .then(() => {
                                document.querySelectorAll('.togglePublic.project').forEach(a => a.addEventListener('click', ev => {
                                    ev.preventDefault()
                                    ev.stopPropagation()
                                    const uri = a.getAttribute("href")
                                    const included = elem.projectCache.has(uri)
                                    a.classList[included ? "remove" : "add"]("is-included")
                                    elem.projectCache[included ? "delete" : "add"](uri)
                                    saveList.style.visibility = "visible"
                                }))
                            })

                        fetch(elem.getAttribute("deer-released")).then(r => r.json())
                            .then(list => {
                                elem.listCache = new Set()
                                list.itemListElement?.forEach(item => elem.listCache.add(item['@id']))
                                for (const a of document.querySelectorAll('.togglePublic.released')) {
                                    const include = elem.listCache.has(a.getAttribute("href")) ? "add" : "remove"
                                    a.classList[include]("is-included")
                                }
                            })
                            .then(() => {
                                document.querySelectorAll(".removeCollectionItem").forEach(el => el.addEventListener('click', (ev) => {
                                    ev.preventDefault()
                                    ev.stopPropagation()
                                    const itemID = el.getAttribute("href")
                                    const fromCollection = document.querySelector('input[deer-collection]').getAttribute("deer-collection")
                                    deleteThis(itemID, fromCollection)
                                }))
                                document.querySelectorAll('.togglePublic.released').forEach(a => a.addEventListener('click', ev => {
                                    ev.preventDefault()
                                    ev.stopPropagation()
                                    const uri = a.getAttribute("href")
                                    const included = elem.listCache.has(uri)
                                    a.classList[included ? "remove" : "add"]("is-included")
                                    elem.listCache[included ? "delete" : "add"](uri)
                                    saveList.style.visibility = "visible"
                                }))
                                saveList.addEventListener('click', overwriteList)
                            })


                        function overwriteList() {
                            let mss_project = []
                            let mss_public = []

                            elem.projectCache.forEach(uri => {
                                mss_project.push({
                                    label: document.querySelector(`deer-view[deer-id='${uri}']`).textContent.trim(),
                                    '@id': uri
                                })
                            })

                            elem.listCache.forEach(uri => {
                                mss_public.push({
                                    label: document.querySelector(`deer-view[deer-id='${uri}']`).textContent.trim(),
                                    '@id': uri
                                })
                            })

                            const list_project = {
                                '@id': elem.getAttribute("deer-listing"),
                                '@context': 'https://schema.org/',
                                '@type': "ItemList",
                                name: "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar",
                                numberOfItems: elem.projectCache.size,
                                itemListElement: mss_project
                            }
                            const list_public = {
                                '@id': elem.getAttribute("deer-released"),
                                '@context': 'https://schema.org/',
                                '@type': "ItemList",
                                name: "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar",
                                numberOfItems: elem.listCache.size,
                                itemListElement: mss_public
                            }

                            fetch(`${tiny}overwrite`, {
                                method: "PUT",
                                mode: 'cors',
                                body: JSON.stringify(list_project)
                            }).then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
                                .catch(err => alert(`Failed to save: ${err}`))

                            fetch(`${tiny}overwrite`, {
                                method: "PUT",
                                mode: 'cors',
                                body: JSON.stringify(list_public)
                            }).then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
                                .catch(err => alert(`Failed to save: ${err}`))
                        }

                        function deleteThis(id, collection) {
                            if (confirm("Really remove this record?\n(Cannot be undone)")) {
                                const historyWildcard = { "$exists": true, "$eq": [] }
                                const queryObj = {
                                    $or: [{
                                        "targetCollection": collection
                                    }, {
                                        "body.targetCollection": collection
                                    }],
                                    target: httpsIdArray(id),
                                    "__rerum.history.next": historyWildcard
                                }
                                fetch(`${tiny}query`, {
                                    method: "POST",
                                    body: JSON.stringify(queryObj)
                                })
                                    .then(r => r.ok ? r.json() : Promise.reject(new Error(r?.text)))
                                    .then(annos => {
                                        let all = annos.map(anno => {
                                            return fetch(`${tiny}delete`, {
                                                method: "DELETE",
                                                body: anno["@id"]
                                            })
                                                .then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
                                                .catch(err => { throw err })
                                        })
                                        Promise.all(all).then(success => {
                                            document.querySelector(`[deer-id="${id}"]`).closest("li").remove()
                                        })
                                    })
                                    .catch(err => console.error(`Failed to delete: ${err}`))
                            }
                        }

                    }
                }
            } catch (err) {
                console.log("Could not build list template.")
                console.error(err)
                return null
            }
        }

    },
    version: "alpha"
}

function httpsIdArray(id,justArray) {
    if (!id.startsWith("http")) return justArray ? [ id ] : id
    if (id.startsWith("https://")) return justArray ? [ id, id.replace('https','http') ] : { $or: [ id, id.replace('https','http') ] }
    return justArray ? [ id, id.replace('http','https') ] : { $or: [ id, id.replace('http','https') ] }
}