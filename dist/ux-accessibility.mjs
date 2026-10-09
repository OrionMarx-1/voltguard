const skip=document.getElementById('skipLink'),main=document.getElementById('mainContent');
function translate(){skip.textContent=window.voltguard.language==='zh'?'跳至主要內容':'Skip to main content';}
skip.addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView({block:'start'});});
window.addEventListener('voltguard-language',translate);translate();
