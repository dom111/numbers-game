import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const cssPath = join(root, 'src/styles.css');

const readText = (path) => readFileSync(path, 'utf8');

const walkFiles = (dir, predicate) => {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            out.push(...walkFiles(full, predicate));
            continue;
        }
        if (predicate(full)) out.push(full);
    }
    return out;
};

const css = readText(cssPath);
const classSelectors = Array.from(css.matchAll(/\.([a-zA-Z_][\w-]*)/g), (m) => m[1]);
const uniqueClassSelectors = [...new Set(classSelectors)].sort();

const searchFiles = [
    ...walkFiles(join(root, 'src'), (file) => file.endsWith('.ts')),
    join(root, 'index.html'),
];

const corpus = searchFiles.map(readText).join('\n');

const knownFrameworkOrGlobal = new Set([
    // base token class is created in number component and also used from CSS descendants
    'number-token',
]);

const likelyUnused = uniqueClassSelectors.filter((cls) => {
    if (knownFrameworkOrGlobal.has(cls)) return false;
    return !(
        corpus.includes(`"${cls}"`) ||
        corpus.includes(`'${cls}'`) ||
        corpus.includes(`.${cls}`)
    );
});

if (likelyUnused.length === 0) {
    console.log('No likely unused class selectors found.');
    process.exit(0);
}

console.log('Likely unused class selectors in src/styles.css:');
for (const selector of likelyUnused) {
    console.log(`- ${selector}`);
}

// Exit non-zero so CI/PR checks can flag drift when desired.
process.exit(1);
