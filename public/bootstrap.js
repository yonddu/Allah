import {initI18n} from './i18n.js';
try{
  await initI18n();
  // Translate before loading the 3D scene; room entry needs no setup dialogs.
  await import('./app.js');
}catch(error){
  console.error(error);
  document.getElementById('loading').hidden=true;
  document.getElementById('fatal').hidden=false;
  const dialog=document.getElementById('mapDialog');if(dialog.open)dialog.close();
}
