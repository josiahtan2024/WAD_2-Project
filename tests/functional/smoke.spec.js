import { test, expect } from './support/fixtures.js'
import { openUniversities } from './support/ui.js'

test('the app loads universities from the fake backend', async ({ page, backend }) => {
  await openUniversities(page)
  await expect(page.getByTestId('university-card')).toHaveCount(6)
  expect(backend.calls('/rest/v1/universities').length).toBeGreaterThan(0)
})
