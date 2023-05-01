const collectionsFile = await fetch('/manage/collections').then(res => res.json())
const collectionMap = new Map(Object.entries(collectionsFile))
import DEER from '/js/deer-config.js'
import UTILS from '/js/deer-utils.js'

function httpsIdArray(id,justArray) {
    if (!id.startsWith("http")) return justArray ? [ id ] : id
    if (id.startsWith("https://")) return justArray ? [ id, id.replace('https','http') ] : { $in: [ id, id.replace('https','http') ] }
    return justArray ? [ id, id.replace('http','https') ] : { $in: [ id, id.replace('http','https') ] }
}

/**
 * Get the moderations for a record or collection.
 * If there is an error, return null.
 * 
 * @param a The record URI to match on 'about'
 * @param r The collection URI to match on 'releasedTo'
 * @return null or an array, even if 0 or 1 matches.
 */ 
function getModerations(a, r){
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    let queryObj = {
        "type" : "Moderation"
    }
    if(a) queryObj.about = a
    if(r) queryObj.releasedTo = httpsIdArray(r)
    return fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers
    })
    .then(res => res.ok ? res.json() : null)
    .catch(err => {
        alert("There was an error getting the Moderations.")
        Promise.reject(err)
        return null
    })
}

/**
 * Get the most recent comment about a record, generated from a review workflow.
 * If there is an error, return null.
 * 
 * @param a The record URI to match on 'about'
 * @param r The collection URI to match on 'releasedTo'
 * @return null or an array, even if 0 or 1 matches.
 */ 
function getComment(uri){
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "type" : "Comment",
        "about": httpsIdArray(uri),
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] }
    }
    return fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers
    })
    .then(res => res.ok ? res.json() : null)
    .catch(err => {
        alert("There was an error getting the Comment for this record.")
        Promise.reject(err)
        return null
    })
}

/**
 * Get the public and managed collection to generate a queue from
 */ 
function fetchItems(event) {
    const selectedCollection = event.target.selectedOptions[0]
    return Promise.all([fetch(selectedCollection.dataset.uri, {cache: "no-cache"}).then(res => res.json()),
    fetch(selectedCollection.dataset.managed, {cache: "no-cache"}).then(res => res.json())])
        .then(([publicCollection, managedCollection]) => {
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_reviewer')) {
                approveBtn.addEventListener('click', approveByReviewer)
                returnBtn.addEventListener('click', returnByReviewer)
                return getReviewerQueue(publicCollection, managedCollection)
            }
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_curator')) {
                approveBtn.addEventListener('click', curatorApproval)
                returnBtn.addEventListener('click', curatorReturn)
                deleteBtn.addEventListener('click', curatorDelete)
                deleteBtn.classList.remove("is-hidden")
                return getCuratorQueue(publicCollection, managedCollection)
            }
        })
        .then(ok=>{
            if(queue.querySelector('li')){
                actions.style.opacity = 1
                queue.querySelector('li').click()
            }
            else{
                // Nothing in the queue to click, reset.
                preview.innerHTML = ""
                selectedRecordTitle.innerText = ""
                actions.style.opacity = 0
                commentToggle.innerHTML = ""
                commentText.innerText = ""
            }

        })
        .catch(err=>{
            alert("There was an issue gathering the collections.  Refresh to try again.")
            Promise.reject(err)
        })
}

/**
 * Intitate a DEER view to generate a preview UI for a selected record from the queue.
 */ 
async function showRecordPreview(event) {
    preview.innerHTML = ``
    commentToggle.innerHTML = ""
    commentText.innerText = ""
    preview.setAttribute("deer-template", "preview")
    preview.setAttribute("deer-id", event.target.dataset.id)
    queue.querySelector(".selected")?.classList.remove("selected")
    event.target.classList.add('selected')
    selectedRecordTitle.innerText = event.target.innerText
    // Sometimes this is a DEER view and does not have the label yet...
    if(!event.target.innerText){
        //Cheat and force this delay.  The text will be there.  Or we can make it a label template itself.
        setTimeout(function(){
            selectedRecordTitle.innerText = event.target.innerText
            //deleteBtn.innerText = `Delete '${event.target.innerText}'`
        },2000)
    }
    const commented = await getComment(event.target.dataset.id)
    //If null, there was an issue getting the comment but we will continue anyway
    if(commented.length){
        // Don't show empty comments
        if(commented[0].text.trim().length){
            commentArea.classList.remove("is-hidden")
            commentToggle.innerHTML = `Comment from <deer-view deer-template="label" deer-id="${commented[0].author ?? ""}"></deer-view> `
            commentText.innerHTML = `<pre>${commented[0].text ?? ""}</pre>`   
            setTimeout(() => UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, commentToggle, { set: commentToggle.querySelectorAll(DEER.VIEW) }))    
        }
        // What if this is the currently logged in user's comment?  For now, we still show it.
    }
}

/**
 * Generate or update the Moderation about a record as a reviewer, suggesting publication for this record.
 * This will alert Curators to review the publication suggestion.
 */ 
async function approveByReviewer() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    // Handle this positive moderation assertion
    let moderated = await getModerations(preview.getAttribute("deer-id"), null)
    const moderation = Object.assign(moderated[0] ?? {
        "@context": {"@vocab":"https://made.up/"},
        type: "Moderation",
        about: preview.getAttribute("deer-id")
    }, {
        author: DLA_USER['http://store.rerum.io/agent'],
        releasedTo: activeCollection.public,
        resultComment: null
    })
    // You will need to create or overwrite this moderation action for the moderation flow.
    const publishFetch = (moderated.length === 0)
        ? fetch(DEER.URLS.CREATE, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })
        : fetch(DEER.URLS.OVERWRITE, {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })
    publishFetch
        .then(res => res.ok || Promise.reject(res))
        .then(success => {
            giveFeedback(`Publication suggested for '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}'`)
            queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
            queue.querySelector('li').click()
        })
        .catch(err => {
            alert("There was an issue approving this item.")
            Promise.reject(err)
        })
}

/**
 * Require changes for a record and provide a comment for contributors.
 * This will alert contributors of an upstream rejection by a reviewer.
 */ 
async function returnByReviewer() {
    const headers =  {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const managedList = await fetch(activeCollection.managed, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            list.itemListElement = list.itemListElement.filter(r => r['@id'].split("/").pop() !== preview.getAttribute("deer-id").split("/").pop())
            list.numberOfItems = list.itemListElement.length
            return list
        })
        .catch(err => {
            alert("There was an issue with returning this item for contributions.")
            Promise.reject(err)
            return null
        })
    if(!managedList) return

    // Handle the negative moderation assertion.
    const callback = async (commentID) =>{
        let moderated = await getModerations(preview.getAttribute("deer-id"), null)
        const moderation = Object.assign(moderated[0] ?? {
            "@context": {"@vocab":"https://made.up/"},
            type: "Moderation",
            about: preview.getAttribute("deer-id")
        }, {
            author: DLA_USER['http://store.rerum.io/agent'],
            releasedTo: null,
            resultComment: commentID
        })
        // You will need to create or overwrite this moderation action for the moderation flow.
        const moderateFetch = (moderated.length === 0)
        ? fetch(DEER.URLS.CREATE, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })
        : fetch(DEER.URLS.OVERWRITE, {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })

        // Ensure moderation flow so the Comment can be connected
        moderateFetch
        .then(res => res.ok || Promise.reject(res))
        .then(success => {
            // Now we have ensured the moderation flow, overwrite the managed list so this item is removed.  
            fetch(DEER.URLS.OVERWRITE, {
                method: 'PUT',
                mode: 'cors',
                body: JSON.stringify(managedList),
                headers
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(success => {
                giveFeedback(`'${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' was returned to contributors.`)
                queue.querySelector(`[data-id="${activeRecord}"]`).remove()
                if(queue.querySelector(`li`)){
                    queue.querySelector(`li`).click()
                }
                else{
                    // Refresh on empty queue view.
                    selectedCollectionElement.dispatchEvent(new Event('input'))
                }
            })
            .catch(err => {
                alert("There was an issue with returning this item for contributions.")
                Promise.reject(err)
            })
        })
        .catch(err => {
            alert("There was an issue with returning this item for contributions.")
            Promise.reject(err)
        })
    }
    // Record the comment for this moderation action
    recordComment(callback)
}

/**
 * Generate a UI to record a Comment for a Moderation 'rejection'
 */ 
async function recordComment(callback) {
    const modalComment = document.createElement('div')
    modalComment.classList.add('modal')
    modalComment.innerHTML = `
    <h3>Return With Comment</h3>
    <h4> 
        Explain why this Record is not ready and detail any changes you are requesting.
        Your comment will be visible to other users.  
    </h4>
    <textarea id="moderationMsg"></textarea>
    <div id="modBtns">
        <button id="msgBtn" role="button">Return For Changes</button>
        <button id="msgCancelButton" onclick="this.parentElement.remove()">❌ Cancel</button>
    </div>
    
    `
    document.body.append(modalComment)
    document.querySelector('.modal button').addEventListener('click', async ev => {
        ev.preventDefault()
        const text = document.querySelector('.modal textarea').value
        const commentID = await saveComment(preview.getAttribute("deer-id"), text)
        document.querySelector('.modal').remove()
        callback(commentID)
    })
}

/**
 * Save or update the Comment about a record, thus recording a Moderation conversation.
 */ 
async function saveComment(target, text) {
    const headers =  {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    let commented = await getComment(target)
    if(commented === null) return
    const dismissingComment = Object.assign(commented[0] ?? {
        "@context": {"@vocab":"https://schema.org/"},
        "type": "Comment"
    },{
        text,
        "about": target,
        author: DLA_USER['http://store.rerum.io/agent']
    })
    let commentFetch = (commented)
        ? fetch(DEER.URLS.CREATE, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(dismissingComment),
            headers
        })
        : fetch(DEER.URLS.UPDATE, {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(dismissingComment),
            headers
        })
    return commentFetch
        .then(res => res.ok ? res.headers.get('location') : Promise.reject(res))
        .catch(err => {
            alert("Could not record comment")
            Promise.reject(err)
        })
}

/**
 * Place a record into the published collection as a curator.
 */ 
async function curatorApproval() {
    const headers =  {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const activeRecord = preview.getAttribute("deer-id")

    // Pull down the managed list and take this record out of it.
    const managedList = await fetch(activeCollection.managed, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            list.itemListElement = list.itemListElement.filter(r => r['@id'].split("/").pop() !== preview.getAttribute("deer-id").split("/").pop())
            list.numberOfItems = list.itemListElement.length
            return list
        })
        .catch(err => {
            alert("There was an error updating the managed list.")
            Promise.reject(err)
            return null
        })

    // Pull down the public list, and add this record to it
    let publicList = await fetch(activeCollection.public, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            const l = queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText
            list.itemListElement.push({"@id":activeRecord, "label":selectedRecordTitle.innerText})
            list.numberOfItems = list.itemListElement.length
            return list
        })
        .catch(err => {
            alert("There was an error updating the public list.")
            Promise.reject(err)
            return null
        })

    if(!(activeRecord && publicList)) return   
    // already published, somehow.  What should we do about this record on the managed list? 
    if (publicList.itemListElement.includes(activeRecord)) return 
        
    fetch(DEER.URLS.OVERWRITE, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(managedList),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(success => {
        fetch(DEER.URLS.OVERWRITE, {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(publicList),
            headers
        })
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(success => {
            giveFeedback(`'${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' is now public.`)
            queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
            queue.querySelector('li').click()
        })
        .catch(err => {
            alert("Issue updating")
            Promise.reject(err)
        })
    })
    .catch(err => {
        alert("Issue updating managed list")
        Promise.reject(err)
    })
}

/**
 * Deny the publication suggestion for a record and provide a comment.
 * This will alert reviewers that this record needs more work, and they can pass it down to a contributor.
 */ 
async function curatorReturn() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const activeRecord = preview.getAttribute("deer-id")
    
    let reviewed = await getModerations(preview.getAttribute("deer-id"), null)
    if(reviewed === null) return
    let moderation = Object.assign(reviewed[0] ?? {
        "@context": {"@vocab":"https://made.up/"},
        type: "Moderation",
        about: preview.getAttribute("deer-id")
    }, {
        author: DLA_USER['http://store.rerum.io/agent'],
        releasedTo: null,
        resultComment: null
    })

    // Handle the negative moderation assertion.
    const callback = (commentID) => {
        moderation.resultComment = commentID
        const publishFetch = (reviewed.length === 0)
        ? fetch(DEER.URLS.CREATE, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })
        : fetch(DEER.URLS.OVERWRITE, {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })
        publishFetch
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(success => {
                giveFeedback(`'${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' was returned to reviewers.`)
                queue.querySelector(`[data-id="${activeRecord}"]`).remove()
                if(queue.querySelector(`li`)){
                    queue.querySelector(`li`).click()
                }
                else{
                    // Refresh on empty queue view.
                    selectedCollectionElement.dispatchEvent(new Event('input'))
                }
            })
            .catch(err => {
                alert("There was an issue rejecting this item")
                Promise.reject(err)
            })
    }
    recordComment(callback)
}

/**
 * Actually delete a record so that it is no longer connected with any collection.
 * The targetCollection Annotations will be deleted.
 * Comments and Moderations will be deleted.
 * The Entity itself is not deleted.
 */ 
async function curatorDelete() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const activeRecord = preview.getAttribute("deer-id")
    const instructions = `'${queue.querySelector(`[data-id="${activeRecord}"]`).innerText}' will be removed from the project and deleted.  You cannot undo this action. \nClick 'OK' to continue.`
    if (confirm(instructions) === false) return

    // If this record is on the published list, it needs to be removed via an OVERWRITE
    const publishedList = await fetch(activeCollection.public, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            const numthen = list.numberOfItems
            list.itemListElement = list.itemListElement.filter(r => r['@id'].split("/").pop() !== preview.getAttribute("deer-id").split("/").pop())
            list.numberOfItems = list.itemListElement.length
            if(numthen !== list.numberOfItems){
                // Gotta overwrite
                fetch(DEER.URLS.OVERWRITE, {
                    method: 'PUT',
                    mode: 'cors',
                    body: JSON.stringify(list),
                    headers
                })
                .then(r => r.ok ? r.json() : Promise.reject(r))
                .catch(err => Promise.reject(err))
            }
            return list
        })
        .catch(err => {
            alert("There was an issue with deleting this record.")
            Promise.reject(err)
            return null
        })

    // If this record is on the managed list, it needs to be removed via an OVERWRITE
    const managedList = await fetch(activeCollection.managed, {cache: "no-cache"})
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(list => {
        const numthen = list.numberOfItems
        list.itemListElement = list.itemListElement.filter(r => r['@id'].split("/").pop() !== preview.getAttribute("deer-id").split("/").pop())
        list.numberOfItems = list.itemListElement.length
        if(numthen !== list.numberOfItems){
            // Gotta overwrite
            fetch(DEER.URLS.OVERWRITE, {
                method: 'PUT',
                mode: 'cors',
                body: JSON.stringify(list),
                headers
            })
            .then(r => r.ok ? r.json() : Promise.reject(r))
            .catch(err => Promise.reject(err) )
        }
        return list
    })
    .catch(err => {
        alert("There was an issue with deleting this record.")
        Promise.reject(err)
        return null
    })
    if(managedList === null || publishedList === null) return
    
    // Get the Comments and Moderations about this item and delete them
    const queryObj = {
        "$or" : [{"type": "Moderation"}, {"type":"Comment"}],
        "about": httpsIdArray(preview.getAttribute("deer-id"))
    }
    let moderation_flow_data = await fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(data_arr => {
        let all = data_arr.map(datapoint => {
            return fetch(DEER.URLS.DELETE, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Authorization": `Bearer ${window.DLA_USER.authorization}`
                },
                body: JSON.stringify(datapoint)
            })
            .catch(err => Promise.reject(err) )
        })
        Promise.all(all)
        .then(success => {
            return true
        })
        .catch(err => {
            alert(`Trouble while deleting target collections annos for '${queue.querySelector(`[data-id="${activeRecord}"]`).innerText}'`)
            Promise.reject(err)
        })

    })
    .catch(err => {
        console.error(err)
        return null
    })

    // Do we care enough to stop, or do we continue on to the targetCollections Annos?
    // if(!moderationFlowData) return

    // Delete the 'targetCollection' Annotation(s) placing this record into this collection
    const qObj = {
        $or: [{
            "targetCollection": activeCollection.targetCollection
        }, {
            "body.targetCollection": activeCollection.targetCollection
        }],
        target: httpsIdArray(activeRecord),
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] }
    }
    fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(qObj),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(annos => {
        let all = annos.map(anno => {
            return fetch(DEER.URLS.DELETE, {
                method: "DELETE",
                headers,
                body: JSON.stringify(anno)
            })
            .catch(err => Promise.reject(err) )
        })
        Promise.all(all)
        .then(success => {
            giveFeedback(`Successfully deleted '${queue.querySelector(`[data-id="${activeRecord}"]`).innerText}'`)
            queue.querySelector(`[data-id="${activeRecord}"]`).remove()
            selectedCollectionElement.dispatchEvent(new Event('input'))
        })
        .catch(err => {
            alert(`Trouble while deleting Moderation for '${queue.querySelector(`[data-id="${activeRecord}"]`).innerText}'`)
            Promise.reject(err)
        })
    })
    .catch(err => {
        alert("There was an issue with deleting this record.")
        Promise.reject(err)
        return null
    })
}

/**
 * Short lived feedback to tell the user what has happened.
 */ 
function giveFeedback(text){
    feedback.innerHTML = `&#8505; ${text}`
    feedback.style.opacity = 1
    setTimeout(function () {
        feedback.style.opacity = 0
    }, 4000)
}


/**
 * A reviewer should see items on the managed list which are not in the public list.
 */ 
async function getReviewerQueue(publicCollection, managedCollection, limit = 10) {
    let recordsToSee = []
    actions.classList.remove("is-hidden")
    let reviewed = await getModerations(null, publicCollection["@id"])
    if(reviewed === null) return
    let disclusions = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
    if(reviewed.length){
        //Also disclude any that have been suggested for publication and are awaiting Curator action.
        disclusions = disclusions.filter(record => {
            let included = true
            reviewed.forEach(moderation => {
                if(moderation.about.split("/").pop() === record["@id"].split("/").pop()) {
                    included = false
                    return
                }
            })
            return included
        })    
    }
    let total = publicCollection.itemListElement.length + managedCollection.itemListElement.length
    let tempQueue = disclusions.slice(0, limit)
    records.innerText = `${disclusions.length} of ${total} records need review.`
    // Select a record to suggest publication.
    queue.innerHTML = `<h3>Queue for Review</h3>
    <ol>${tempQueue.reduce((a, b) => a += `<li data-id="${b['@id'].replace('http:','https:')}">${b.label}</li>`, ``)}</ol>`
    queue.querySelectorAll('li').forEach(addRecordHandlers)
}

/**
 * A curator has the option to look at the managed list or the public list for each collection.  
 * Items which have a moderating Annotation requesting to be public for a collection take precedent.
 */ 
async function getCuratorQueue(publicCollection, managedCollection, limit = 10) {
    const selectedCollection = selectedCollectionElement.selectedOptions[0].innerText
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    selectedCollectionElement.style.opacity = 1
    // Curators do not see comments.
    commentArea.classList.add("is-hidden")
    actions.classList.remove("is-hidden")
    let recordsToSee = []
    // Preference seeing records that have been suggested for publication by reviewers
    let reviewed = await getModerations(null, activeCollection.public)
    if(reviewed === null) return
    selectedCollectionElement.style.opacity = 1
    const total = publicCollection.itemListElement.length + managedCollection.itemListElement.length
    if(reviewed.length){
        //Preference records suggested for publication by reviewers
        selectedCollectionElement.style.opacity = 0.5
        giveFeedback("You must address all publication suggestions before viewing this collection")
        records.innerText = `${reviewed.length} records suggested for publication.  Select a record to publish it.`
        recordsToSee = reviewed
    }
    else if(selectedCollection.includes("Published")){
        //They want to see items in the published list, even if 0.
        recordsToSee = publicCollection.itemListElement
        records.innerText = `${recordsToSee.length} of ${total} records are public!`
        // Curators do not have available actions for the published list -- that is a different interface.
        actions.classList.add("is-hidden")
    }
    else{
        // They want to see the managed list.
        // Disclude public items and items with positive moderation
        recordsToSee = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
        recordsToSee = recordsToSee.filter(record => {
            let included = true
            reviewed.forEach(moderation => {
                if(moderation.about.split("/").pop() === record["@id"].split("/").pop()) {
                    included = false
                    return
                }
            })
            return included
        })    
        records.innerText = `${recordsToSee.length} of ${total} records are not public.`
        // Select a record to publish it.
    }
    let tempQueue = recordsToSee.slice(0, limit)    
    queue.innerHTML = (reviewed.length) 
        ? queue.innerHTML = `<ol>${reviewed.reduce((a, b) => a += `<li data-id="${b.about}"><deer-view deer-template="label" deer-id="${b.about}"></deer-view></li>`, ``)}</ol>`
        : queue.innerHTML = `<ol>${tempQueue.reduce((a, b) => a += `<li data-id="${b['@id']}">${b.label}</li>`, ``)}</ol>`
    queue.querySelectorAll('li').forEach(addRecordHandlers)
    // The queue may have new deer-template="label" elems.  Broadcast those new views to DEER so they render.
    const newViews = (queue.querySelectorAll(DEER.VIEW).length) ? queue.querySelectorAll(DEER.VIEW) : []
    UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, queue, { set: newViews })
}

function attachCollectionHandler(selectElement) {
    selectElement.addEventListener('input', fetchItems)
}

function addRecordHandlers(record) {
    record.addEventListener('click', showRecordPreview)
}

function countItems(collection) {
    records.innerText = collection.numberOfItems
}

document.querySelector('auth-button button').addEventListener('dla-authenticated', drawInterface)

if (window?.DLA_USER) drawInterface()

/**
 * Generate the Collections selector based on user role, and select one so initiate the interface for that collection.
 * Also set the user information in the UI for the logged in user.
 */ 
function drawInterface() {
    const roles = DLA_USER['http://dunbar.rerum.io/user_roles']?.roles.filter(role => role.includes('dunbar_user'))
    if (roles.includes("dunbar_user_curator")) user.dataset.role = "curator"
    if (roles.includes("dunbar_user_reviewer")) user.dataset.role = "reviewer"
    user.innerHTML = `
    <p>▶ Logged in as ${DLA_USER.nickname ?? DLA_USER.name} with role${roles.length > 1 ? `s` : ``} ${roles.map(r => r.split('_').pop()).join(" | ")}.</p>
    `
    const select = document.createElement('select')
    select.id = "selectedCollectionElement"
    collectionMap.forEach((v, k) => {
        const opt_managed_list = document.createElement('option')
        const opt_published_list = document.createElement('option')
        opt_managed_list.classList.add('collection')
        opt_published_list.classList.add('collection')
        opt_managed_list.dataset.uri = v.public
        opt_published_list.dataset.uri = v.public
        opt_managed_list.dataset.managed = v.managed
        opt_published_list.dataset.managed = v.managed
        const roles = DLA_USER['http://dunbar.rerum.io/user_roles']?.roles.filter(role => role.includes('dunbar_user'))
        let sanity = k
        sanity = sanity.replace("Published", "")
        sanity = sanity.replace("Managed", "")
        if (user.dataset.role === "curator"){
            opt_published_list.innerText = `Published ${sanity}`
            opt_managed_list.innerText = `Unreviewed ${sanity}`
            opt_published_list.value = k
            opt_managed_list.value = k
            select.append(opt_published_list)
            select.append(opt_managed_list)
            approveBtn.innerText = "Approve for Publication"
            returnBtn.innerText = "Ask for Changes"
            deleteBtn.classList.remove("is-hidden")
        }
        if (user.dataset.role === "reviewer"){
            opt_managed_list.innerText = `Unreviewed ${sanity}`
            opt_managed_list.value = k
            select.append(opt_managed_list)
            approveBtn.innerText = "Suggest Publication"
            returnBtn.innerText = "Return for Contributions"
        }
    })
    collections.append(select)
    attachCollectionHandler(select)
    select.options[0].selected = true
    select.dispatchEvent(new Event('input'))
}
export { collectionMap }
