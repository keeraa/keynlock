import assert from 'node:assert/strict';
import {landmarkTextureImagesReady} from '../js/path-builder/landmark-preview-ready.js';

const loaded={roof:{image:{naturalWidth:1024,complete:true}},stone:{image:{width:512,complete:true}}};
assert.equal(landmarkTextureImagesReady(loaded),true,'Decoded roof and stone paint is safe to capture');
assert.equal(landmarkTextureImagesReady({roof:{image:undefined}}),false,
  'Thumbnail rendering must wait before painting has loaded');
assert.equal(landmarkTextureImagesReady({roof:{image:{naturalWidth:0,complete:true}}}),false,
  'A failed texture request cannot be captured as a black roof');
assert.equal(landmarkTextureImagesReady({roof:{image:{width:512,complete:false}}}),false,
  'An image with dimensions still needs to finish decoding');
console.log('Landmark thumbnails: painted textures are ready before GPU capture');
