const fs = require('fs');
let code = fs.readFileSync('src/SteFin.jsx', 'utf8');

code = code.replace(/const \{([^}]+)\} = useLanguage\(\)/g, (match, p1) => {
  if (p1.includes('privacyMode')) return match;
  return `const { ${p1.trim()}, privacyMode, togglePrivacyMode } = useLanguage()`
});

code = code.replace(/(?<!const )formatIDR\(([^)]+)\)/g, "(privacyMode ? 'Rp •••••••' : formatIDR($1))");

fs.writeFileSync('src/SteFin.jsx', code);
console.log('Modified SteFin.jsx');
