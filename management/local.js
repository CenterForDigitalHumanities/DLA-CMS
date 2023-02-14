const collectionsFile = await fetch('/manage/collections').then(res => res.json())
const collectionMap = new Map(Object.entries(collectionsFile))

function fetchItems(event){
    return fetch(event.target.dataset.uri).then(res=>res.json())
    .then(collection=>countItems(collection))
}

function attachCollectionHandlers(button) {
    button.addEventListener('click',fetchItems)
}

function countItems(collection){
    records.innerText = collection.numberOfItems
}

collectionMap.forEach((v,k)=>{
    const btn = document.createElement('button')
    btn.classList.add('collections')
    btn.dataset.uri = k
    btn.innerText = v
    collections.append(btn)
    attachCollectionHandlers(btn)
})

export { collectionMap }
