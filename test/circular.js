var SyncedObjectStore = require('../index.js')

// SOS boilerplate
syncedObjectStoreA = new SyncedObjectStore() 
syncedObjectStoreB = new SyncedObjectStore(true)

// pipe em up
streamA = syncedObjectStoreA.createStream()
streamB = syncedObjectStoreB.createStream()
streamA.pipe(streamB).pipe(streamA)

// create a circular object
var circ = {}
circ.self = circ
syncedObjectStoreA.register(circ)

// did it work?
syncedObjectStoreB.on('create',function(newObj){
  var test = newObj.self === newObj
  console.log( test ? 'it worked' : 'it failed')
  console.log(newObj.self)
})