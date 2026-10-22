import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
const cache = new Map()
function load(relativePath) {
  const filename = path.resolve(root, relativePath)
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  const localRequire = specifier => {
    // These tests cover serialization/Markdown parsing, not browser sanitization.
    if (specifier === 'dompurify') return { sanitize: value => value }
    if (specifier.startsWith('@/')) return load(`src/${specifier.slice(2)}.ts`)
    if (specifier.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), `${specifier}.ts`)))
    return require(specifier)
  }
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, require: localRequire }, { filename })
  cache.set(filename, module.exports)
  return module.exports
}

const { serializeEditorToMarkdown, renderMarkdownToEditorHtml } = load('src/features/article-editor/model/editor-markdown.ts')
const text = (value, ...marks) => ({ type: 'text', text: value, marks: marks.map(mark => typeof mark === 'string' ? { type: mark } : mark) })
const paragraph = (...content) => ({ type: 'paragraph', content })
const lineBreak = { type: 'hardBreak' }
const serialize = (...content) => serializeEditorToMarkdown({ getJSON: () => ({ type: 'doc', content }) })
const render = (...content) => renderMarkdownToEditorHtml(serialize(...content))
const inlineHtml = (...content) => render(paragraph(...content)).replace(/^<p>/, '').replace(/<\/p>\n?$/, '')

test('bold spans with boundary whitespace never bold the intervening plain text', () => {
  assert.equal(inlineHtml(text('left ', 'bold'), text('plain'), text(' right', 'bold')),
    '<strong>left </strong>plain<strong> right</strong>')
})

test('adjacent text nodes with overlapping marks do not produce ambiguous delimiters', () => {
  assert.equal(inlineHtml(text('first', 'bold'), text('second', 'bold', 'italic'), text('third', 'bold')),
    '<strong>first</strong><em><strong>second</strong></em><strong>third</strong>')
  assert.equal(inlineHtml(text('a'), text('@', 'bold'), text('b')), 'a<strong>@</strong>b')
})

test('all supported inline marks survive together, including inline code', () => {
  const html = inlineHtml(text('literal `*value*`', 'code', 'bold', 'italic', 'strike', 'underline', 'highlight'))
  assert.equal(html, '<mark><u><s><em><strong><code>literal `*value*`</code></strong></em></s></u></mark>')
})

test('inline code preserves backticks and leading/trailing spaces', () => {
  assert.equal(inlineHtml(text(' `some``code` ', 'code')), '<code> `some``code` </code>')
})

test('each pasted soft line keeps its own indentation, including tabs and split text nodes', () => {
  const html = render(paragraph(text('    one'), lineBreak, text('  '), text('  two', 'bold'), lineBreak, text('\tthree')))
  const lines = html.replace(/^<p>/, '').replace(/<\/p>\n?$/, '').split(/<br\s*\/?>\n?/)
  assert.equal(lines.length, 3)
  for (const line of lines) assert.match(line, /^(?:&nbsp;|\u00a0){4}/)
  assert.ok(lines[1].includes('<strong>two</strong>'))
})

test('full-width indentation remains full-width even at document boundaries', () => {
  assert.equal(inlineHtml(text('\u3000\u3000line')), '\u3000\u3000line')
})

test('literal HTML, entities and Markdown punctuation remain literal user text', () => {
  assert.equal(inlineHtml(text('<T> &copy; &nbsp; **not bold** [x](y)')),
    '&lt;T&gt; &amp;copy; &amp;nbsp; **not bold** [x](y)')
})

test('aligned paragraphs and headings contain HTML marks, not unparsed Markdown', () => {
  const p = { ...paragraph(text('center', 'bold'), lineBreak, text('code', 'code')), attrs: { textAlign: 'center' } }
  const heading = { type: 'heading', attrs: { level: 3, textAlign: 'right' }, content: [text('title', 'italic')] }
  const html = render(p, heading)
  assert.match(html, /<p style="text-align: center;"><strong>center<\/strong><br\s*\/?><code>code<\/code><\/p>/)
  assert.match(html, /<h3 style="text-align: right;"><em>title<\/em><\/h3>/)
  assert.equal(render({ ...paragraph(), attrs: { textAlign: 'center' } }), '<p style="text-align: center;"></p>')
})

test('code blocks keep consecutive blank lines and embedded fence delimiters', () => {
  const value = 'one\n\n\n```\ntwo\n'
  const html = render({ type: 'codeBlock', attrs: { language: 'js' }, content: [text(value)] })
  assert.equal(html, `<pre><code class="language-js">${value}</code></pre>`)
})

test('intentional empty paragraphs are not discarded between content blocks', () => {
  const html = render(paragraph(text('before')), paragraph(), paragraph(), paragraph(text('after')))
  assert.equal((html.match(/<p><\/p>/g) ?? []).length, 2)
})

test('an entirely empty editor still serializes to an empty body', () => {
  assert.equal(serialize(paragraph()), '')
})

const item = (...content) => ({ type: 'listItem', content })
test('ordered-list starts and nested bullet lists survive saving', () => {
  const html = render({ type: 'orderedList', attrs: { start: 8 }, content: [
    item(paragraph(text('eight')), { type: 'bulletList', content: [item(paragraph(text('nested')))] }),
    item(paragraph(text('nine'))),
  ] })
  assert.match(html, /<ol start="8">/)
  assert.match(html, /<li>eight<ul><li>nested<\/li><\/ul><\/li>/)
})

test('multiple paragraphs in a list item remain separate paragraphs', () => {
  const html = render({ type: 'bulletList', content: [item(paragraph(text('first')), paragraph(text('second')))] })
  assert.match(html, /<li><p>first<\/p><p>second<\/p><\/li>/)
})

test('table cells retain paragraph alignment and nested block structure', () => {
  const html = render({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [
    { ...paragraph(text('cell', 'bold')), attrs: { textAlign: 'right' } },
    { type: 'bulletList', content: [item(paragraph(text('entry')))] },
    { type: 'blockquote', content: [paragraph(text('quote'))] },
  ] }] }] })
  assert.match(html, /<p style="text-align: right;"><strong>cell<\/strong><\/p>/)
  assert.match(html, /<ul>[\s\S]*<li><p>entry<\/p><\/li>[\s\S]*<\/ul>/)
  assert.match(html, /<blockquote><p>quote<\/p><\/blockquote>/)
})

test('links with parentheses and ampersands keep their href and marked label', () => {
  const html = inlineHtml(text('label', 'bold', { type: 'link', attrs: { href: 'https://example.test/a_(b)?x=1&y=2' } }))
  assert.match(html, /href="https:\/\/example\.test\/a_\(b\)\?x=1&amp;y=2"/)
  assert.ok(html.includes('<strong>label</strong></a>'))
})

test('images retain titles and URLs containing parentheses', () => {
  const html = render({ type: 'image', attrs: { src: 'https://example.test/a_(b).png', alt: 'cover', title: 'caption' } })
  assert.match(html, /src="https:\/\/example\.test\/a_\(b\)\.png"/)
  assert.match(html, /title="caption"/)
  assert.ok(!html.includes('null'))
  assert.match(render({ type: 'image', attrs: { src: 'https://example.test/a_(b.png', alt: 'cover' } }), /a_\(b\.png/)
})

const setup = parse(fs.readFileSync(path.join(root, 'src/features/article-editor/ui/ArticleEditorForm.vue'), 'utf8')).descriptor.scriptSetup.content
const ast = ts.createSourceFile('editor.ts', setup, ts.ScriptTarget.Latest, true)
const pasteHelperSource = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createPlainTextPasteContent').getText(ast)
const pasteContext = {}
vm.runInNewContext(ts.transpileModule(`${pasteHelperSource}\nthis.paste = createPlainTextPasteContent;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, pasteContext)

test('plain-text paste retains per-line indentation and intentional blank paragraphs', () => {
  const pasted = JSON.parse(JSON.stringify(pasteContext.paste('    one\r\n\t two\r\n\r\n\r\n\r\n\u3000three')))
  assert.equal(pasted.length, 3)
  assert.deepEqual(pasted[0].content, [{ type: 'text', text: '    one' }, lineBreak, { type: 'text', text: '\t two' }])
  assert.deepEqual(pasted[1], paragraph())
  assert.deepEqual(pasted[2].content, [{ type: 'text', text: '\u3000three' }])
})

test('code-block paste delegates literal text and URLs to ProseMirror', () => {
  const declaration = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === 'contentEditor')).declarationList.declarations[0]
  const options = declaration.initializer.arguments[0]
  const editorProps = options.properties.find(node => node.name?.getText(ast) === 'editorProps').initializer
  const handler = editorProps.properties.find(node => node.name?.getText(ast) === 'handlePaste').initializer.getText(ast)
  const context = {
    contentEditor: { value: { isActive: type => type === 'codeBlock' } },
    resolvePastedLinkHref() { assert.fail('code-block text must not go through link conversion') },
  }
  vm.runInNewContext(ts.transpileModule(`this.paste = ${handler};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  assert.equal(context.paste({}, { clipboardData: { getData: () => 'https://example.test/\n    code' }, preventDefault() { assert.fail('native code-block paste must remain enabled') } }), false)
})
