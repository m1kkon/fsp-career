import {httpError} from './http.mjs';

// Privileges are derived on every request, never accepted from account JSON.
export function isTestMaintainer(userId, environment=process.env) {
 return !!userId && (environment.TEST_MAINTAINER_IDS||'').split(',').map(id=>id.trim()).filter(Boolean).includes(userId);
}
export function assessmentAccount(account, environment=process.env) {
 if (!account) throw httpError('Войдите в аккаунт.',401);
 return {...account,maintainer:isTestMaintainer(account.id,environment)};
}
export function requireTestMaintainer(account, environment=process.env) {
 const current=assessmentAccount(account,environment);
 if (!current.maintainer) throw httpError('Доступ только для администраторов тестирования.',403);
 return current;
}
