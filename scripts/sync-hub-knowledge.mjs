import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
const hub = path.resolve(process.argv[2] || '../smajpihub');
const documents = [];
const sources = [];
function source(file) {
  const text = fs.readFileSync(path.join(hub, file), 'utf8');
  sources.push({ file, sha256: crypto.createHash('sha256').update(text).digest('hex') });
  return text;
}
const whitePaper = source('By_smaj_pi_hub_white_paper_v2.md');
for (const [index, text] of whitePaper.split(/(?=^## )/m).entries()) {
  documents.push({ id: `white-paper-${index}`, title: text.split('\n')[0].replace(/^#+ /, ''), file: sources[0].file, url: 'https://smajpihub.com/white-paper', text: text.trim() });
}
const legalFile = 'frontend/src/pages/LegalPages.tsx';
const ast = ts.createSourceFile(legalFile, source(legalFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const pages = { PrivacyPage: '/privacy', TermsPage: '/terms', CookiesPage: '/cookies', SellerAgreementPage: '/seller-agreement', ReportAbusePage: '/report-abuse' };
function visit(node) {
  if (ts.isVariableDeclaration(node) && pages[node.name.getText(ast)]) {
    const page = node.name.getText(ast);
    function section(child) {
      if (ts.isObjectLiteralExpression(child)) {
        const heading = child.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'heading');
        if (heading && ts.isStringLiteral(heading.initializer)) {
          const strings = [];
          function literal(n) { if (ts.isStringLiteral(n)) strings.push(n.text); else ts.forEachChild(n, literal); }
          literal(child);
          documents.push({ id: `${page}-${documents.length}`, title: `${page.replace('Page', '')}: ${heading.initializer.text}`, file: legalFile, url: `https://smajpihub.com${pages[page]}`, text: strings.join('\n') });
        }
      }
      ts.forEachChild(child, section);
    }
    section(node);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (documents.length < 40) throw new Error('Incomplete knowledge extraction');
fs.writeFileSync('src/knowledge/hub.json', JSON.stringify({ schemaVersion: 1, sources, documents }, null, 2) + '\n');
console.log(`Synced ${documents.length} source sections without modifying HUB files.`);
