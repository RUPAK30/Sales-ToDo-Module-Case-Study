/* A different calm palette each visit (kept for the session, never the same as last time). */
(function(){var P=[
 {n:'sage',a:'#EEF3E6',b:'#FBEBDD',c:'#F2ECF5',acc:'#3F6B4F',d:'#2F5240',s:'#EEF4EC',l:'#CFE0CF',g:'rgba(63,107,79,.12)'},
 {n:'plum',a:'#F4ECF3',b:'#FBF1E2',c:'#EAF2EA',acc:'#6B4A6B',d:'#523852',s:'#F6EFF5',l:'#E3D2E2',g:'rgba(107,74,107,.12)'},
 {n:'clay',a:'#FBEDE4',b:'#E9F3EE',c:'#F6F0E6',acc:'#8A5A44',d:'#6E4634',s:'#F8F0EA',l:'#E8D5C9',g:'rgba(138,90,68,.12)'},
 {n:'olive',a:'#F1F1E2',b:'#F9E9EA',c:'#EEF1EA',acc:'#5C6B3A',d:'#48552C',s:'#F2F4EA',l:'#DCE2C8',g:'rgba(92,107,58,.12)'}],i;
try{i=sessionStorage.getItem('tt-pal');}catch(e){}
if(i===null||i===undefined||!P[i]){var last;try{last=+localStorage.getItem('tt-pal-last');}catch(e){}do{i=Math.floor(Math.random()*P.length);}while(i===last&&P.length>1);try{sessionStorage.setItem('tt-pal',i);localStorage.setItem('tt-pal-last',i);}catch(e){}}
var p=P[i],r=document.documentElement.style;r.setProperty('--pa',p.a);r.setProperty('--pb',p.b);r.setProperty('--pc',p.c);r.setProperty('--acc',p.acc);r.setProperty('--acc-d',p.d);r.setProperty('--acc-soft',p.s);r.setProperty('--acc-line',p.l);r.setProperty('--acc-glow',p.g);document.documentElement.dataset.pal=p.n;})();
