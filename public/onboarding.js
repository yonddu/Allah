export function initOnboarding(){
  const $=id=>document.getElementById(id),dialog=$('mapDialog');
  let needsSetup=true,step=1,ready=false;
  try{needsSetup=localStorage.getItem('noor-onboarded')!=='1';}catch{}
  const panel=$('customPanel'),scene=$('scene'),panelHome=document.createComment('customizer home'),sceneHome=document.createComment('scene home');
  panel.before(panelHome);scene.before(sceneHome);
  function restore(){
    if(panel.parentElement===$('entryCharacterHost'))panelHome.after(panel);
    if(scene.parentElement===$('entryAvatarPreview'))sceneHome.after(scene);
    window.dispatchEvent(new CustomEvent('noor:entry-character',{detail:{active:false}}));
  }
  function show(next){
    restore();step=Math.max(1,Math.min(2,next));document.documentElement.dataset.entryStep=step;
    for(const section of dialog.querySelectorAll('[data-entry-stage]'))section.hidden=Number(section.dataset.entryStage)!==step;
    for(const indicator of dialog.querySelectorAll('[data-entry-dot]'))indicator.classList.toggle('active',Number(indicator.dataset.entryDot)===step);
    $('entryBackButton').hidden=step===1||!needsSetup;$('entryNextButton').hidden=step===2;$('entryNextButton').disabled=!ready;
    $('entryLoadingStatus').hidden=ready;$('mapCloseButton').hidden=needsSetup;
    dialog.classList.toggle('character-step',step===1);
    if(step===1){
      $('entryCharacterHost').append(panel);$('entryAvatarPreview').append(scene);
      window.dispatchEvent(new CustomEvent('noor:entry-character',{detail:{active:true}}));
    }
    dialog.scrollTop=0;
  }
  $('entryNextButton').addEventListener('click',()=>{if(ready)show(step+1);});
  $('entryBackButton').addEventListener('click',()=>show(step-1));
  dialog.addEventListener('cancel',e=>{if(needsSetup)e.preventDefault();});
  window.addEventListener('noor:app-ready',()=>{ready=true;$('entryNextButton').disabled=false;$('entryLoadingStatus').hidden=true;});
  window.addEventListener('noor:select-room',()=>show(needsSetup?step:2));
  window.addEventListener('noor:entered',()=>{
    restore();needsSetup=false;try{localStorage.setItem('noor-onboarded','1');}catch{}
    $('mapCloseButton').hidden=false;
  });
  dialog.addEventListener('close',()=>restore());
  show(needsSetup?1:2);
}
