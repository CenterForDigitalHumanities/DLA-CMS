const collectionsFile = await fetch('/manage/collections').then(res => res.json())
const collectionMap = new Map(Object.entries(collectionsFile))
import DEER from '/js/deer-config.js'
import UTILS from '/js/deer-utils.js'

function httpsIdArray(id,justArray) {
    if (!id.startsWith("http")) return justArray ? [ id ] : id
    if (id.startsWith("https://")) return justArray ? [ id, id.replace('https','http') ] : { $in: [ id, id.replace('https','http') ] }
    return justArray ? [ id, id.replace('http','https') ] : { $in: [ id, id.replace('http','https') ] }
}

function fetchItems(event) {
    const selectedCollection = event.target.selectedOptions[0]
    if(selectedCollection.dataset.uri === ""){
        // Then there will be nothing for the queue because the collection URI is not yet available.
        preview.innerHTML = ""
        selectedRecordTitle.innerText = ""
        actions.style.opacity = 0
        records.innerText = "This collection is not available yet."
    }
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
            }

        })
        .catch(err=>Promise.reject(err))
}

function showRecordPreview(event) {
    preview.innerHTML = ``
    preview.setAttribute("deer-template", "preview")
    preview.setAttribute("deer-id", event.target.dataset.id)
    queue.querySelector(".selected")?.classList.remove("selected")
    event.target.classList.add('selected')
    selectedRecordTitle.innerText = event.target.innerText
    // Sometimes this is a deer form and does not have the label yet...
    if(!event.target.innerText){
        //Cheat and force this delay.  The text will be there.  Or we can make it a label template itself.
        setTimeout(function(){
            selectedRecordTitle.innerText = event.target.innerText
        },2000)
    }
    
    const headers = {
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "type" : "Comment",
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        "about": httpsIdArray(event.target.dataset.id)
    }
    fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(comment=> {
        if(comment.length && comment[0]){
            commentToggle.innerHTML = `Comment from <deer-view deer-template="label" deer-id="${comment[0].author}"></deer-view> `
            commentText.innerHTML = `<pre>${comment[0].text}</pre>`  
        }
         //We will need need to broadcast the view
        setTimeout(() => UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, commentToggle, { set: commentToggle.querySelectorAll(DEER.VIEW) }))    
    })
    .catch(err => {
        giveFeedback("Trouble loading preview")
        Promise.reject(err)
    })

}

async function approveByReviewer() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    // Handle this positive moderation assertion
    const queryObj = {
        "type" : "Moderation",
        "about": httpsIdArray(preview.getAttribute("deer-id"))
    }
    let moderated = await fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .catch(err => Promise.reject(err))

    const moderation = Object.assign(moderated[0] ?? {
        "@context": {"@vocab":"https://made.up/"},
        type: "Moderation",
        about: preview.getAttribute("deer-id"),
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
        .then(success => giveFeedback(`Publication suggested for '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}'`))
        .then(ok=>{
            queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
            queue.querySelector('li').click()
        })
        .catch(err => {
            alert("There was an issue approving this item.")
            Promise.reject(err)
        })

}

async function returnByReviewer() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const managedlist = await fetch(activeCollection.managed, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            list.itemListElement = list.itemListElement.filter(r => r['@id'].split("/").pop() !== preview.getAttribute("deer-id").split("/").pop())
            list.numberOfItems = list.itemListElement.length
            return list
        })

    const callback = async (commentID) =>{
        // Handle the negative moderation assertion.
        const moderationQuery = {
            "type" : "Moderation",
            "about": httpsIdArray(preview.getAttribute("deer-id"))
        }
        let moderated = await fetch(DEER.URLS.QUERY, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(moderationQuery),
            headers
        })
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .catch(err => Promise.reject(err))

        const moderation = Object.assign(moderated[0] ?? {
            "@context": {"@vocab":"https://made.up/"},
            type: "Moderation",
            about: preview.getAttribute("deer-id"),
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
                body: JSON.stringify(managedlist),
                headers
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(success => giveFeedback(`'${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' was returned to contributors.`))
            .then(ok=>{
                queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
                queue.querySelector('li').click()
            })
            .catch(err => {
                alert("There was an issue removing this item.")
                Promise.reject(err)
            })
        })
        .catch(err => {
            alert("There was an issue removing this item.")
            Promise.reject(err)
        })
    }
    // Record the comment for this moderation action
    recordComment(callback)
}

async function recordComment(callback) {
    const modalComment = document.createElement('div')
    modalComment.classList.add('modal')
    modalComment.innerHTML = `
    <header>Return with comment</header>
    <p> Explain why this Record is not ready for release or request changes. </p>
    <textarea></textarea>
    <button role="button">Commit message</button>
    <a href="#" onclick="this.parentElement.remove()">❌ Cancel</a>
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

async function saveComment(target, text) {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "type": "Comment",
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        "about": target
    }
    let commented = await fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .catch(err => Promise.reject(err))

    const dismissingComment = Object.assign(commented[0] ?? {
        "@context": {"@vocab":"https://schema.org/"},
        "type": "Comment"
    },{
        text,
        "about": target,
        author: DLA_USER['http://store.rerum.io/agent']
    })
    let commentFetch = (commented.length === 0)
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
        .catch(err => Promise.reject(err))
}

async function curatorApproval() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const activeRecord = await fetch(activeCollection.managed, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(array => array.itemListElement.find(r => r['@id'] === preview.getAttribute("deer-id")))
    let list = await fetch(activeCollection.public, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
    if (list.itemListElement.includes(activeRecord)) {
        return // already published, somehow
    }
    list.itemListElement.push(activeRecord)
    list.numberOfItems = list.itemListElement.length
    fetch(DEER.URLS.UPDATE, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(list),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(success => giveFeedback(`'${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' is now public.`))
    .then(ok=>{
        queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
        queue.querySelector('li').click()
    })
    .catch(err => {
        alert("Issue publishing item")
        Promise.reject(err)
    })
}

async function curatorReturn() {
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const activeRecord = preview.getAttribute("deer-id")

    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "releasedTo": activeCollection.public,
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        "about": httpsIdArray(preview.getAttribute("deer-id"))
    }
    let reviewed = await fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .catch(err => Promise.reject(err))

    let moderation = Object.assign(reviewed[0] ?? {
        "@context": {"@vocab":"https://made.up/"},
        type: "Moderation",
        about: preview.getAttribute("deer-id"),
    }, {
        author: DLA_USER['http://store.rerum.io/agent'],
        releasedTo: null,
        resultComment: null
    })

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
            .then(res => res.ok || Promise.reject(res))
            .then(success => giveFeedback(`Public visibility denied for '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}'`))
            .then(ok=>{
                queue.querySelector(`[data-id="${activeRecord}"]`).remove()
                if(queue.querySelector(`li`)){
                    queue.querySelector(`li`).click()
                }
                else{
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

async function curatorDelete() {
    const instructions = "This record will be removed from the project and deleted.  You cannot undo this action. \nClick 'OK' to continue."
    if (confirm(instructions) === false) return
    
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const activeRecord = preview.getAttribute("deer-id")
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }

    // This is going to require a handful of fetches that all need to succeed.
    let allFetches = []

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
        data_arr.forEach(datapoint => {
            const deleteFetch = fetch("//tinypaul.rerum.io/dla/delete", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Authorization": `Bearer ${window.DLA_USER.authorization}`
                },
                body: datapoint["@id"] ?? datapoint.id
            })
            .catch(err => Promise.reject(err) )
            allFetches.push(deleteFetch)
        })
    })
    .catch(err => {
        console.error(err)
        return null
    })
    // If there is a query error, fail out.
    if(moderation_flow_data === null) return

    const publishedList = await fetch(activeCollection.public, {cache: "no-cache"})
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            const numnow = list.numberOfItems
            list.itemListElement = list.itemListElement.filter(r => r['@id'].split("/").pop() !== preview.getAttribute("deer-id").split("/").pop())
            list.numberOfItems = list.itemListElement.length
            if(numnow !== list.numberOfItems){
                // Gotta overwrite, add that to our array of fetches
                allFetches.push(fetch(DEER.URLS.OVERWRITE, {
                    method: 'PUT',
                    mode: 'cors',
                    body: JSON.stringify(list),
                    headers
                })
                .then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
                .catch(err => Promise.reject(err)))
            }
            return list
        })

    const managedlist = await fetch(activeCollection.managed, {cache: "no-cache"})
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(list => {
        const numnow = list.numberOfItems
        list.itemListElement = list.itemListElement.filter(r => r['@id'].split("/").pop() !== preview.getAttribute("deer-id").split("/").pop())
        list.numberOfItems = list.itemListElement.length
        if(numnow !== list.numberOfItems){
            // Gotta overwrite, add that to our array of fetches
            allFetches.push(fetch(DEER.URLS.OVERWRITE, {
                method: 'PUT',
                mode: 'cors',
                body: JSON.stringify(list),
                headers
            })
            .then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
            .catch(err => Promise.reject(err) ))
        }
        return list
    })
    //Do all of the deletes and overwrites.  This should only be considered successful if they all work.
    return Promise.all(all)
        .then(success => giveFeedback(`Successfully deleted '${queue.querySelector(`[data-id="${activeRecord}"]`).innerText}'`))
        .then(ok => {
            queue.querySelector(`[data-id="${activeRecord}"]`).remove()
            if(queue.querySelector(`li`)){
                queue.querySelector(`li`).click()
            }
            else{
                selectedCollectionElement.dispatchEvent(new Event('input'))
            }
        })
        .catch(err => {
            alert(`Trouble while removing record '${queue.querySelector(`[data-id="${activeRecord}"]`).innerText}'`)
            Promise.reject(err)
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
 * Items promoted to the managed list by a contributor should take precedent
 * Not sure how to detect a new/promoted record vs. one that has been there b/c of the script.
 */ 
async function getReviewerQueue(publicCollection, managedCollection, limit = 10) {
    let recordsToSee = []
    const queryObj = {
        "releasedTo": httpsIdArray(publicCollection["@id"]),
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] }
    }
    let reviewed = await fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers:{
            "Content-Type":"application/json; charset=utf-8"
        }
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))

    let disclusions = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
    if(reviewed.length){
        //Also disclude any that have been suggested for publication and are awaiting Curator action.
        disclusions = disclusions.filter(record => {
            let included = true
            reviewed.forEach(moderation => {
                if(moderation.releasedTo && moderation.about.split("/").pop() === record["@id"].split("/").pop()) {
                    included = false
                    return
                }
            })
            return included
        })    
    }

    let tempQueue = disclusions.slice(0, limit)
    records.innerText = `${disclusions.length} records are not published.  Select a record to suggest publication.`
    queue.innerHTML = `<h3>Queue for Review</h3>
    <ol>${tempQueue.reduce((a, b) => a += `<li data-id="${b['@id'].replace('http:','https:')}">${b.label}</li>`, ``)}</ol>`
    queue.querySelectorAll('li').forEach(addRecordHandlers)
}

/**
 * A reviewer should see items on the managed list which are not in the public list.
 * They also need a way to access the public list upon request to remove from it.
 * Items which have a moderating Annotation requesting to be public should take precedent and be seen by default.
 */ 
async function getCuratorQueue(publicCollection, managedCollection, limit = 10) {
    const selectedCollection = selectedCollectionElement.selectedOptions[0].innerText
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    selectedCollectionElement.style.opacity = 1
    // Curators do not see comments.
    commentArea.style.display = "none"
    let recordsToSee = []
    // Preference seeing records that have been suggested for publication by reviewers
    const queryObj = {
        "releasedTo": httpsIdArray(activeCollection.public),
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] }
    }
    let reviewed = await fetch(DEER.URLS.QUERY, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj),
        headers:{
            "Content-Type":"application/json; charset=utf-8"
        }
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))

    selectedCollectionElement.style.opacity = 1
    if(reviewed.length){
        //Preference records suggested for publication by reviewers
        selectedCollectionElement.style.opacity = 0.5
        giveFeedback("You must address all publication suggestions before viewing this collection")
        records.innerText = `${reviewed.length} records suggested for publication`
        recordsToSee = reviewed
    }
    else if(selectedCollection.includes("Published")){
        //They want to see items in the published list, even if 0.
        
        recordsToSee = publicCollection.itemListElement
         records.innerText = `${recordsToSee.length} published records!`
    }
    else{
        //They want to see the managed list.
        recordsToSee = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
        records.innerText = `${recordsToSee.length} records are not published.  Select a record to review it for publication.`
    }
    let tempQueue = recordsToSee.slice(0, limit)    
    queue.innerHTML = (reviewed.length) 
        ? queue.innerHTML = `<ol>${reviewed.reduce((a, b) => a += `<li data-id="${b.about}"><deer-view deer-template="label" deer-id="${b.about}"></deer-view></li>`, ``)}</ol>`
        : queue.innerHTML = `<ol>${tempQueue.reduce((a, b) => a += `<li data-id="${b['@id']}">${b.label}</li>`, ``)}</ol>`
    // The preview was already on the page and is recognized by DEER.
    queue.querySelectorAll('li').forEach(addRecordHandlers)
    // The queue is full of new deer-template="label" elems.  Broadcast those new views to DEER so they render.
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
commentToggle.addEventListener("click", e => {
    if(e.target.tagName === "PRE"){
        //This way they can highlight and select text
        return
    }
    if(commentText.classList.contains("is-hidden")){
        commentText.querySelector(".statusDrawer").classList.remove("is-hidden")
    }
    else{
        commentText.querySelector(".statusDrawer").classList.add("is-hidden")
    }
})

if (window?.DLA_USER) drawInterface()

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
            opt_managed_list.innerText = `Managed ${sanity}`
            opt_published_list.value = k
            opt_managed_list.value = k
            select.append(opt_published_list)
            select.append(opt_managed_list)
            approveBtn.innerText = "Approve for Publication"
            returnBtn.innerText = "Ask for Changes"
        }
        if (user.dataset.role === "reviewer"){
            opt_managed_list.innerText = `Managed ${sanity}`
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
