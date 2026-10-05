import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createFrameLimiter } from '../../src/shared/utils/animationFrame.ts'

// Keep production imports bundler-native while testing the actual TS implementation on Node 22.
const source = readFileSync(new URL('../../src/shared/utils/textPressureScheduler.ts', import.meta.url), 'utf8').replace(/^import .*$/gm, '')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
new Function('createFrameLimiter', 'exports', code)(createFrameLimiter, exports)
export const createTextPressureScheduler = exports.createTextPressureScheduler
