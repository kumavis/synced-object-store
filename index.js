var EventEmitter = require('events').EventEmitter
var WeakMap = require('weak-map')
var extend = require('extend')
var Doc = require('crdt').Doc
var SetGetWrapper = require('set-get-wrapper')

module.exports = SyncedObjectStore

// SyncedObjectStore constructor
function SyncedObjectStore(isB){
  var self = this
  // force instantiation with the `new` keyword
  if (!(self instanceof SyncedObjectStore)) return new SyncedObjectStore()
  // allow self to emit events for module consumer
  extend(self,new EventEmitter())
  // create a registry for tracking objects
  self._registry = new WeakMap()
  // create a synced JSON store
  self._origin = new Doc()
  // syncing 
  self._origin.on('create', function(clone){
    // wrap in `nextTick` so that if it was created locally,
    // it can finish registration first
    process.nextTick(function(){
      var syncedObject = self._registry.get(clone)
      if (!syncedObject) syncedObject = self._createObjFromClone(clone)
      self.emit('create',syncedObject)
    })
  })
}

// Create a duplexStream for syncing SyncedObjectStores
SyncedObjectStore.prototype.createStream = function(){
  var self = this
  return self._origin.createStream()
}

// Check an object for untracked keys
SyncedObjectStore.prototype.updateKeys = function(newObj,newKeys){
  SetGetWrapper.updateKeys(newObj,newKeys)
}

// Add any javascript object to the synced store
SyncedObjectStore.prototype.register = function(newObj){
  var self = this
  // check if obj is already registered
  var clone = self._registry.get(newObj)
  var id = clone ? clone.id : null
  // if not, start registering
  if (!id) {
    // create a network-use clone of the object with properties that are objects replaced with reference ids
    var clone = self._origin.add({})
    id = clone.id
    // bidirectionally register the object/clone pair
    self._registry.set(newObj,clone)
    self._registry.set(clone,newObj)
    // activate setters and getters on newObj that connect it to the clone
    // as a side effect, it will also recursively register all properties that are objects
    SetGetWrapper.useAsWrapper(newObj,{
      get: incommingGet.bind(self,clone),
      set: incommingSet.bind(self,newObj,clone),
    })
  }
  // return the id of this object
  return id
}

// Private - when a new clone is brought in from the network, create the corresponding object
SyncedObjectStore.prototype._createObjFromClone = function(clone){
  var self = this
  // create a new obj to match the clone
  var newObj = {}
  // get keys from clone
  var keysToTrack = []
  Object.keys(clone.state).map(function(key){
    // if it is an escaped key, unescape and add to obj
    if (key[0] === '$') {
      var escapedKey = key.slice(1)
      keysToTrack.push(escapedKey)
    }
  })
  // link obj to provided clone
  SetGetWrapper.useAsWrapper(newObj,{
    get: incommingGet.bind(self,clone),
    set: incommingSet.bind(self,newObj,clone),
  })
  SetGetWrapper.addKeys(newObj,keysToTrack)
  // bidirectionally register the object
  self._registry.set(newObj,clone)
  self._registry.set(clone,newObj)
  return newObj
}

// handle value gets
function incommingGet(clone,key){
  var self = this
  // retrieve value from clone with an escaped key
  var value = clone.get('$'+key)
  // if the value is an object, then it is an object reference
  // and we return the referenced object
  if (value !== null && typeof value === 'object') {
    var childId = value._id
    var childClone = self._origin.get(childId)
    value = self._registry.get(childClone)
  }
  return value
}

// handle value sets
function incommingSet(newObj,clone,key,value){
  var self = this
  // if a property is a simple value, store it
  // if a property is an object, register it and store an 'object lookup'
  if (value !== null && typeof value === 'object') {
    var childId = self.register(value)
    value = { _id: childId }
  }
  // store the value on the clone in an escaped key
  clone.set('$'+key,value)
  return value
}
