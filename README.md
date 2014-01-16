# synced-object-store
  
I put this together as a fun hack to experiment on top of the [Scuttlebutt family](https://github.com/dominictarr/scuttlebutt).
It attempts to sync javascript objects across a distributed system, with object references intact.

### shortcommings

In order for this to work it needs:
  - to be able to replace the values of the object to register (most properties on something like `window` dont allow this)
  - to know what keys to track on an object (it does an initial search on register, but if additional keys are added later via `SyncedObjectStore#updateKeys`)