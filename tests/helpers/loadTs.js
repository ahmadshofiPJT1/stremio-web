// Copyright (C) 2017-2026 Smart code 203358507

// Loads a dependency-free TypeScript module from src/ for unit tests.
// Jest here has no TypeScript transform, so we transpile on the fly.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const loadTs = (relativePath) => {
    const fullPath = path.resolve(__dirname, '..', '..', relativePath);
    const source = fs.readFileSync(fullPath, 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2019,
        },
        fileName: fullPath,
    });

    const module = { exports: {} };
    new Function('module', 'exports', 'require', outputText)(module, module.exports, require);
    return module.exports;
};

module.exports = loadTs;
