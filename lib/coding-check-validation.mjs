import {requireValue} from './domain.mjs';
import {MARKUP_RULES,validCssExpectation} from './markup-checks.mjs';
export function validatedCodingChecks(c){
 return c.tests.map(t=>{
  requireValue(t&&typeof t==='object'&&typeof t.stdin==='string'&&t.stdin.length<=4000&&typeof t.public==='boolean','Каждая проверка должна содержать stdin (текст до 4000 символов) и public (true/false).');
  requireValue(t.contains===undefined,'Проверка по наличию строк ненадёжна. Используйте expected, comparison: json или структурное правило markupRule.');
  requireValue(t.comparison===undefined||['exact','json'].includes(t.comparison),'Неизвестное правило сравнения.');
  if(t.markupRule!==undefined){
   requireValue(MARKUP_RULES.includes(t.markupRule)&&['html','css','react'].includes(c.language),'Неизвестное структурное правило или неверный язык.');
   requireValue(t.comparison===undefined,'Структурная проверка не совмещается с comparison.');
   requireValue(['dom','dom-attributes'].includes(t.markupRule)?['html','react'].includes(c.language):t.markupRule==='css-properties'||/^(toolbar|cards|layout)-/.test(t.markupRule)?c.language==='css':c.language==='html','Структурное правило не соответствует языку задания.');
   if(t.markupRule==='css-properties')requireValue(validCssExpectation(t.expected),'Укажите корректный JSON с selector, properties и необязательной шириной width.');
  }
  requireValue(t.markupRule&&!['dom','dom-attributes','css-properties'].includes(t.markupRule)||typeof t.expected==='string'&&t.expected.length<=4000,'Укажите expected (текст до 4000 символов).');
  requireValue(t.expected===undefined||typeof t.expected==='string'&&t.expected.length<=4000,'expected должен быть текстом до 4000 символов.');
  if(t.comparison==='json'){try{JSON.parse(t.expected);}catch{requireValue(false,'expected должен быть корректным JSON.');}}
  return {stdin:t.stdin,public:t.public,...(t.expected!==undefined?{expected:t.expected}:{}),...(t.comparison?{comparison:t.comparison}:{}),...(t.markupRule?{markupRule:t.markupRule}:{})};
 });
}
