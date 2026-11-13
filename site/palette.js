/* A fresh calm palette on every visit or reload, never the same as the last one.
   Moving between pages within a few seconds keeps the same palette, so the site feels like one place. */
(function(){var P=[
 {n:'sage', a:'#DCEBD3',b:'#FBE3CF',c:'#E9DFF1',d2:'#F6EFE4',acc:'#3F6B4F',d:'#2F5240',s:'#EEF4EC',l:'#CFE0CF',g:'rgba(63,107,79,.14)'},
 {n:'plum', a:'#EBD9EA',b:'#FCEBD3',c:'#D9ECDF',d2:'#F4EEF5',acc:'#6B4A6B',d:'#523852',s:'#F6EFF5',l:'#E3D2E2',g:'rgba(107,74,107,.14)'},
 {n:'clay', a:'#F8DCCB',b:'#D7EDE3',c:'#F3E7CF',d2:'#FBF2EC',acc:'#8A5A44',d:'#6E4634',s:'#F8F0EA',l:'#E8D5C9',g:'rgba(138,90,68,.14)'},
 {n:'olive',a:'#E5E8C9',b:'#F6D9DC',c:'#DCE9E1',d2:'#F5F3E8',acc:'#5C6B3A',d:'#48552C',s:'#F2F4EA',l:'#DCE2C8',g:'rgba(92,107,58,.14)'},
 {n:'rose', a:'#F6D8D9',b:'#E4E6CF',c:'#F2E2CC',d2:'#FBF0EF',acc:'#8C4A57',d:'#6F3843',s:'#F9EFF0',l:'#EBCFD4',g:'rgba(140,74,87,.14)'}],i,last,at=0;
try{last=+localStorage.getItem('tt-pal-last');at=+localStorage.getItem('tt-pal-at')||0;}catch(e){}
if(P[last]&&Date.now()-at<8000){i=last;}else{do{i=Math.floor(Math.random()*P.length);}while(i===last&&P.length>1);}
try{localStorage.setItem('tt-pal-last',i);}catch(e){}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a&&a.host===location.host){try{localStorage.setItem('tt-pal-at',Date.now());}catch(x){}}},true);
var p=P[i],r=document.documentElement.style;
[['--pa',p.a],['--pb',p.b],['--pc',p.c],['--pd',p.d2],['--acc',p.acc],['--acc-d',p.d],['--acc-soft',p.s],['--acc-line',p.l],['--acc-glow',p.g]].forEach(function(x){r.setProperty(x[0],x[1]);});
document.documentElement.dataset.pal=p.n;})();
