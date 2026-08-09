// Local development runs the suite against the sibling hydrargyri checkout when
// one is there — the incremental row wiring rides a core newer than the
// published peer, and this is how it is exercised before that core ships. CI
// has no sibling checkout, so it tests the published peer and the full-rescan
// fallback instead: two environments, both paths covered, and no file:
// dependency for npm ci to choke on.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const sibling = join(dirname(fileURLToPath(import.meta.url)), '..', 'hydrargyri', 'src', 'scripts', 'hydrargyri.js')

export default {
  testEnvironment: 'jsdom',
  transform: {},
  moduleNameMapper: existsSync(sibling) ? { '^hydrargyri$': sibling } : {}
}
