import {createWorkbenchApp} from './workbench-app.js';

// Standalone entry. Embedded scenes use workbench-mount.js instead.
const app=createWorkbenchApp({root:document.querySelector('main.app')});
window.addEventListener('beforeunload',()=>app.dispose(),{once:true});
