import {selectedModel} from './user-model-catalog.js';
// IDs are visual presets from the supplied images, never inferred identities.
export const CHARACTERS=Array.from({length:7},(_,i)=>({id:'face'+String(i+1).padStart(2,'0'),index:i,gender:i===6?'female':'male'}));
const looks=[
 ['thobe','ghutra'],['shalwar','kufi'],['melayu','songkok'],['sarong','songkok'],['djellaba','hood'],
 ['tunic','embroidered'],['abaya','hijab'],['rose','hijab'],['sage','hijab'],['coat','hijab'],
 ['thobe','embroidered'],['shalwar','pakol'],['shalwar','kufi'],['tunic','embroidered'],['batik','songkok']
];
export const WARDROBE=looks.map(([cut,cover],i)=>({id:'look'+String(i+1).padStart(2,'0'),index:i,gender:i>=6&&i<=9?'female':'male',cut,cover}));
export function avatarSelection(raw){
 const gender=raw.gender==='female'?'female':'male';
 return {model:selectedModel({...raw,gender}).id,character:CHARACTERS.find(c=>c.id===raw.character&&c.gender===gender)?.id||(gender==='female'?'face07':'face01'),wardrobe:WARDROBE.find(c=>c.id===raw.wardrobe&&c.gender===gender)?.id||(gender==='female'?'look07':'look01')};
}
