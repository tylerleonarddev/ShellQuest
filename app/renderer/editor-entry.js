// Bundled by esbuild into editor.bundle.js (global: SQEditor).
// The renderer stays framework-free; this file only wires up CodeMirror 6.
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { indentUnit, bracketMatching, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Colors come from the same token palette as style.css.
const theme = EditorView.theme(
  {
    '&': { backgroundColor: '#0d1219', color: '#c8d3de', fontSize: '14px', height: '100%' },
    '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace", caretColor: '#3dd68c' },
    '.cm-cursor': { borderLeftColor: '#3dd68c' },
    '.cm-gutters': { backgroundColor: '#0d1219', color: '#44546a', border: 'none', borderRight: '1px solid #1d2530' },
    '.cm-activeLine': { backgroundColor: 'rgba(61, 214, 140, 0.05)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#3dd68c' },
    '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(61, 214, 140, 0.18)' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true }
);

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#7aa2f7' },
  { tag: tags.string, color: '#3dd68c' },
  { tag: tags.number, color: '#e0af68' },
  { tag: tags.comment, color: '#5a6b80', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#c8d3de' },
  { tag: tags.definition(tags.variableName), color: '#c8d3de' },
  { tag: tags.operator, color: '#89a0b8' },
  { tag: tags.bool, color: '#e0af68' },
]);

export function create(parent, doc) {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        indentUnit.of('    '),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        python(),
        theme,
        syntaxHighlighting(highlight),
      ],
    }),
    parent,
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (text) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
