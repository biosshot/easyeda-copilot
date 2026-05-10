import { marked, TokenizerExtension } from 'marked';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import katex from 'katex';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
// @ts-ignore
import 'highlight.js/styles/atom-one-light.css';
import './markdown.css';

declare global {
    interface Window {
        hljs: typeof hljs;
    }
}

window.hljs = hljs;

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);

const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1(?=[\s?!.,:;]|$)/;
const inlineRuleNonStandard = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1/;
const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;
const specialTokenRule = /(?<=^|\s)(#(?:[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)|\/(?:block_diagram|diagnostic_algorithm|component_search|circuit_maker|circuit_explainer|planning|user_quide)\b)/

function markedKatex(options = {}) {
    return {
        extensions: [
            inlineKatex({ ...options, nonStandard: false }, createRenderer({ ...options, nonStandard: false }, false)),
            blockKatex({ ...options, nonStandard: false }, createRenderer({ ...options, nonStandard: false }, true)),
            inlineKatex({ ...options, nonStandard: true }, createRenderer({ ...options, nonStandard: true }, false)),
            blockKatex({ ...options, nonStandard: true }, createRenderer({ ...options, nonStandard: true }, true)),
        ],
    };
}

function createRenderer(options: object, newlineAfter: boolean) {
    return (token: { text: string; displayMode: boolean }) => katex.renderToString(token.text, { ...options, displayMode: token.displayMode }) + (newlineAfter ? '\n' : '');
}

function inlineKatex(options: object, renderer: unknown): TokenizerExtension {
    const nonStandard = 'nonStandard' in options && options.nonStandard;
    const ruleReg = nonStandard ? inlineRuleNonStandard : inlineRule;
    return {
        name: 'inlineKatex',
        level: 'inline',
        start(src: string) {
            let index;
            let indexSrc = src;

            while (indexSrc) {
                index = indexSrc.indexOf('$');
                if (index === -1) {
                    return;
                }
                const found = nonStandard ? index > -1 : index === 0 || indexSrc.charAt(index - 1) === ' ';
                if (found) {
                    const possibleKatex = indexSrc.substring(index);

                    if (possibleKatex.match(ruleReg)) {
                        return index;
                    }
                }

                indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, '');
            }
        },
        tokenizer(src: string) {
            const match = src.match(ruleReg);

            if (match) {
                return {
                    type: 'inlineKatex',
                    raw: match[0],
                    text: match[2].trim(),
                    displayMode: match[1].length === 2,
                };
            }
        },
        renderer,
    } as TokenizerExtension;
}

function blockKatex(options: object, renderer: unknown): TokenizerExtension {
    return {
        name: 'blockKatex',
        level: 'block',
        tokenizer(src: string) {
            const match = src.match(blockRule);
            if (match) {
                return {
                    type: 'blockKatex',
                    raw: match[0],
                    text: match[2].trim(),
                    displayMode: match[1].length === 2,
                };
            }
        },
        renderer,
    } as TokenizerExtension;
}

marked.use(markedKatex({ throwOnError: false, nonStandard: true }));
marked.use({
    extensions: [
        {
            name: 'specialToken',
            level: 'inline',

            tokenizer(src: string) {
                const match = src.match(specialTokenRule);
                if (!match) return;
                return {
                    type: 'specialToken',
                    raw: match[0],
                    text: match[0],
                };
            },
            renderer(token: { text: string }) {
                return `<span class="token-designator">${token.text}</span>`;
            },
        } as TokenizerExtension,
    ],
});

marked.use({
    renderer: {
        code({ text, lang }) {
            const code = text;
            const normalizedLang = lang?.toLowerCase().trim();
            const header = `
            <div class="code-header">
                <span>${normalizedLang ?? 'plaintext'}</span>
            </div>`;

            if (normalizedLang) {
                try {
                    if (window.hljs.getLanguage(normalizedLang)) {
                        return `<div class="code-block">${header}<pre><code class="language-${normalizedLang} hljs">${window.hljs.highlight(code, { language: normalizedLang }).value}</code></pre></div>`;
                    }
                } catch (err) {
                    console.error('Highlight error:', err);
                }
            }

            return `<div class="code-block">${header}<pre><code class="hljs">${window.hljs.highlightAuto(code).value}</code></pre></div>`;
        },
        link({ href, title, text }) {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${text}</a>`;
        },
    },
    gfm: true,
    pedantic: false,
});

export const markdown = (content: string) => {
    content = content.replace(
        /\\\[(.*?)\\\]|\\\((.*?)\\\)|\((.*?)\)/gms,
        (match, displayFormula, inlineFormula, inlineFormula2) => {
            if (displayFormula !== undefined && displayFormula.includes('\\')) {
                return `\n$$${displayFormula}$$\n`;
            }
            if (inlineFormula !== undefined) {
                return `$${inlineFormula}$`;
            }
            if (inlineFormula2 !== undefined && inlineFormula2.length < 16 && inlineFormula2.includes('{') && inlineFormula2.includes('}')) {
                return `$${inlineFormula2}$`;
            }
            return match;
        }
    );

    return marked.parse(content, { async: false });
};
