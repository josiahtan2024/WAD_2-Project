/**
 * Fetch exchange rates from Frankfurter (https://www.frankfurter.app, free, no key).
 * Must be async with loading and error states handled by the caller.
 * @param {string} from - base currency, e.g. 'SGD'
 * @param {string} to - target currency, e.g. 'EUR'
 * @returns {Promise<number>} rate such that 1 `from` = rate `to`
 */
export async function getRate(from, to) {
  // TODO(student): implement
  throw new Error('Not implemented')
}
