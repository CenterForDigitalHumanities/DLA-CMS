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
    return Promise.all([fetch(selectedCollection.dataset.uri, {cache: "no-cache"}).then(res => res.json()),
    fetch(selectedCollection.dataset.managed, {cache: "no-cache"}).then(res => res.json())])
        .then(([publicCollection, managedCollection]) => {
            countItems(publicCollection)
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
        .then(ok=>queue.querySelector('li').click())
        .catch(err=>console.error(err))
}

function showRecordPreview(event) {
    preview.innerHTML = ``
    preview.setAttribute("deer-template", "preview")
    preview.setAttribute("deer-id", event.target.dataset.id)
    queue.querySelector(".selected")?.classList.remove("selected")
    event.target.classList.add('selected')
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
        (comment[0]) ? actions.querySelector('span').innerHTML = `Comment from ${comment[0].author}: <p>${comment[0].text}</p> ` : ``
    })
    .catch(err => {
        console.log("Trouble loading preview")
        console.error(err)
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
    .catch(err => console.error(err))

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
        .then(success => actions.querySelector('span').innerHTML= `✔ publication suggested for '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}'`)
        .then(ok=>{
            queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
            queue.querySelector('li').click()
            setTimeout(function () {actions.querySelector('span').innerHTML=""}, 2000)
        })
        .catch(err => {
            alert("There was an issue approving this item.")
            console.error(err)
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
        .catch(err => console.error(err))

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

            .then(success => actions.querySelector('span').innerHTML= `❌ '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' was returned to contributors.`)
            .then(ok=>{
                queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
                queue.querySelector('li').click()
                setTimeout(function () {actions.querySelector('span').innerHTML=""}, 2000)
            })
            .catch(err => {
                alert("There was an issue removing this item.")
                console.log(err)
            })
        })
        .catch(err => {
            alert("There was an issue removing this item.")
            console.error(err)
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
    .catch(err => console.error(err))

    const dismissingComment = Object.assign(commented[0] ?? {
        "@context": {"@vocab":"https://schema.org/"},
        "type": "Comment",
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
        actions.querySelector('span').innerHTML= `✔ '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' is now public.`
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
    .then(success => actions.querySelector('span').innerHTML= `✔ '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}' is now public.`)
    .then(ok=>{
        queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
        queue.querySelector('li').click()
        setTimeout(function () {actions.querySelector('span').innerHTML=""}, 2000)
    })
    .catch(err => {
        alert("Issue publishing item")
        console.error(err)
    })
}

async function curatorReturn() {
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    const activeRecord = preview.getAttribute("deer-id")
    // TODO: This is nearly a straight C/P frpm above
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
    .catch(err => {console.error(err)})

    let moderation = Object.assign(reviewed[0] ?? {
        "@context": {"@vocab":"https://made.up/"},
        type: "Moderation",
        about: preview.getAttribute("deer-id"),
    }, {
        creator: DLA_USER['http://store.rerum.io/agent'],
        releasedTo: null,
        resultComment: null
    })

    const callback = commentID => {
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
            .then(success => actions.querySelector('span').innerHTML=`❌ Public visibility denied for '${queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).innerText}'`)
            .then(ok=>{
                queue.querySelector(`[data-id="${activeRecord}"]`).remove()
                if(queue.querySelector(`li`)){
                    queue.querySelector(`li`).click()
                }
                else{
                    selectedCollectionElement.dispatchEvent(new Event('input'))
                }
                setTimeout(function () {actions.querySelector('span').innerHTML=""}, 2000)
            })
            .catch(err => {
                alert("There was an issue rejecting this item")
                console.error(err)
            })
    }
    recordComment(callback)
}

/**
 * A reviewer should see items on the managed list which are not in the public list.
 * Items promoted to the managed list by a contributor should take precedent
 * Not sure how to detect a new/promoted record vs. one that has been there b/c of the script.
 */ 
async function getReviewerQueue(publicCollection, managedCollection, limit = 10) {
    const disclusions = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
    let tempQueue = disclusions.slice(0, limit)
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
    const disclusions = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
    let tempQueue = disclusions.slice(0, limit)
    const activeCollection = collectionMap.get(selectedCollectionElement.value)
    //Check for any records waiting to be released.  If there are some, show them by default
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
        const opt = document.createElement('option')
        opt.classList.add('collection')
        opt.dataset.uri = v.public
        opt.dataset.managed = v.managed
        const roles = DLA_USER['http://dunbar.rerum.io/user_roles']?.roles.filter(role => role.includes('dunbar_user'))
        let sanity = k
        sanity = sanity.replace("Published", "")
        sanity = sanity.replace("Managed", "")
        //It would be idea to do the buttons in the preview template.
        if (roles.includes("dunbar_user_curator")){
            sanity = `Published ${sanity}`
            approveBtn.innerText = "Approve for Publication"
            returnBtn.innerText = "Ask for Changes"
        }
        if (roles.includes("dunbar_user_reviewer")){
            sanity = `Managed ${sanity}`
            approveBtn.innerText = "Suggest Publication"
            returnBtn.innerText = "Return for Contributions"
        }
        opt.innerText = sanity
        opt.value = k
        select.append(opt)
    })
    collections.append(select)
    attachCollectionHandler(select)
    select.options[0].selected = true
    select.dispatchEvent(new Event('input'))

}
export { collectionMap }
