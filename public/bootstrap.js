import {initI18n} from './i18n.js';
import {initOnboarding} from './onboarding.js';
try{
  await initI18n();
  initOnboarding();
  // Language is usable before the larger 3D module is downloaded or initialized.
  await import('./app.js');
}catch(error){
  console.error(error);
  document.getElementById('loading').hidden=true;
  document.getElementById('fatal').hidden=false;
  const dialog=document.getElementById('mapDialog');if(dialog.open)dialog.close();
}
