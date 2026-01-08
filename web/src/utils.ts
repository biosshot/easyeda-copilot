import { marked } from 'marked'

import hljs from 'highlight.js';
import katex from 'katex';

export const isEasyEda = () => !!(window as any).eda;

(window as any).hljs = hljs;

const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1(?=[\s?!\.,:？！。，：]|$)/;
const inlineRuleNonStandard = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1/; // Non-standard, even if there are no spaces before and after $ or $$, try to parse

const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;

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

function createRenderer(options: any, newlineAfter: any) {
    return (token: any) => katex.renderToString(token.text, { ...options, displayMode: token.displayMode }) + (newlineAfter ? '\n' : '');
}

function inlineKatex(options: any, renderer: any) {
    const nonStandard = options && options.nonStandard;
    const ruleReg = nonStandard ? inlineRuleNonStandard : inlineRule;
    return {
        name: 'inlineKatex',
        level: 'inline',
        start(src: any) {
            let index;
            let indexSrc = src;

            while (indexSrc) {
                index = indexSrc.indexOf('$');
                if (index === -1) {
                    return;
                }
                const f = nonStandard ? index > -1 : index === 0 || indexSrc.charAt(index - 1) === ' ';
                if (f) {
                    const possibleKatex = indexSrc.substring(index);

                    if (possibleKatex.match(ruleReg)) {
                        return index;
                    }
                }

                indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, '');
            }
        },
        tokenizer(src: any, tokens: any) {
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
    };
}

function blockKatex(options: any, renderer: any) {
    return {
        name: 'blockKatex',
        level: 'block',
        tokenizer(src: any, tokens: any) {
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
    };
}

marked.use(markedKatex({ throwOnError: false, nonStandard: true }));

marked.use({
    renderer: {

        code({ text, lang }) {
            const code = text;
            const header = `
            <div class="code-header">
                <span>${lang ?? 'plaintext'}</span>
            </div>`;

            if (lang) {
                try {
                    if ((window as any).hljs.getLanguage(lang)) {
                        return `<div class="code-block">${header}<pre><code class="language-${lang} hljs">${(window as any).hljs.highlight(code, { language: lang }).value}</code></pre></div>`;
                    }
                } catch (err) {
                    console.error('Highlight error:', err);
                }
            }

            return `<div class="code-block">${header}<pre><code class="hljs">${(window as any).hljs.highlightAuto(code).value}</code></pre></div>`;
        },
        link({ href, title, text }) {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${text}</a>`;
        },
    },
    gfm: true,
    pedantic: false
})

export const markdown = (content: string) => {
    content = content.replace(
        /\\\[(.*?)\\\]|\\\((.*?)\\\)|\((.*?)\)/gms,
        (match, displayFormula, inlineFormula, inlineFormula_2) => {
            if (displayFormula !== undefined && displayFormula.includes('\\')) {
                return `\n$$${displayFormula}$$\n`;
            }
            if (inlineFormula !== undefined) {
                return `$${inlineFormula}$`;
            }
            if (inlineFormula_2 !== undefined && inlineFormula_2.length < 16 && inlineFormula_2.includes('{') && inlineFormula_2.includes('}')) {
                return `$${inlineFormula_2}$`;
            }
            return match; // не содержит LaTeX — оставляем без изменений
        }
    );

    return marked.parse(content, { async: false });
};

export const showToastMessage = (mes: string, type: "error" | "warn" | "info" | "success" | "question") => isEasyEda() ? eda.sys_Message.showToastMessage(mes, type as ESYS_ToastMessageType) : null
