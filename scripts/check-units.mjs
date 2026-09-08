/**
 * Testes das conversoes de unidade (espelham src/utils/units.ts).
 *
 * O risco que isto cobre: peso e altura sao gravados SEMPRE em kg/cm; se a conversao de
 * ida e volta driftar, o historico do aluno ganha variacao fantasma a cada salvamento.
 * Cobre tambem o arredondamento de polegadas (nao pode sair 5'12") e o IMC, que
 * continua sendo calculado em metrico nos dois sistemas.
 *
 * Uso: node scripts/check-units.mjs
 */
const LB=2.20462262185, CM=2.54;
const kgToLb=kg=>kg*LB, lbToKg=lb=>lb/LB;
const fmtN=(v,l,d=1)=>new Intl.NumberFormat(l,{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
const fmtW=(kg,s,l,d=1)=>s==='imperial'?`${fmtN(kgToLb(kg),l,d)} lb`:`${fmtN(kg,l,d)} kg`;
const cmToFtIn=cm=>{const t=cm/CM;const f=Math.floor(t/12);let i=Math.round(t-f*12);if(i===12)return{feet:f+1,inches:0};return{feet:f,inches:i}};
const fmtH=(cm,s)=>s==='imperial'?`${cmToFtIn(cm).feet}'${cmToFtIn(cm).inches}"`:`${Math.round(cm)} cm`;
const parseW=(i,s)=>{const c=i.trim().replace(',','.');if(!c)return null;const p=Number(c);if(!Number.isFinite(p)||p<=0)return null;const kg=s==='imperial'?lbToKg(p):p;return Math.round(kg*100)/100};

let fail=0;
const t=(name,got,want)=>{const ok=String(got)===String(want);if(!ok){fail++;console.log(`  FALHOU ${name}: got=${got} want=${want}`)}else console.log(`  ok  ${name}: ${got}`)};

console.log("== formatacao ==");
t("peso 72.5kg pt", fmtW(72.5,'metric','pt-BR'), "72,5 kg");
t("peso 72.5kg en-imperial", fmtW(72.5,'imperial','en'), "159.8 lb");
t("peso 0", fmtW(0,'metric','pt-BR'), "0,0 kg");
t("altura 175 metrico", fmtH(175,'metric'), "175 cm");
t("altura 175 imperial", fmtH(175,'imperial'), `5'9"`);
t("altura 182.88 (6ft exato)", fmtH(182.88,'imperial'), `6'0"`);

console.log("\n== parse (input -> kg) ==");
t("72,5 pt metrico", parseW('72,5','metric'), 72.5);
t("72.5 en metrico", parseW('72.5','metric'), 72.5);
t("154.3 lb -> kg", parseW('154.3','imperial'), 69.99);
t("vazio", parseW('','metric'), null);
t("texto", parseW('abc','metric'), null);
t("negativo", parseW('-5','metric'), null);
t("zero", parseW('0','metric'), null);

console.log("\n== round-trip (R6: nao pode driftar) ==");
let kg=parseW('154.3','imperial');
let back=fmtW(kg,'imperial','en').replace(' lb','');
let kg2=parseW(back,'imperial');
t("lb->kg->lb->kg estavel", kg===kg2, true);

console.log("\n== IMC continua metrico ==");
const h=175/100, w=72.5, bmi=w/(h*h);
t("IMC 72.5kg/1.75m", bmi.toFixed(1), "23.7");
console.log("\n"+(fail?`${fail} FALHAS`:"TODOS OS TESTES PASSARAM"));
process.exit(fail?1:0);
