// # fetch.js
import fs from 'node:fs';
import path from 'node:path';
import core from '@actions/core';

const cwd = process.env.GITHUB_WORKSPACE ?? process.cwd();
let file = path.join(cwd, 'src/yaml/smf-16/everseasonal.yaml');

await fs.promises.mkdir(path.dirname(file), { recursive: true });
await fs.promises.writeFile(file, `
group: smf-16
name: everseasonal
version: "1.0.2"
# subfolder: 150-mods
info:
  summary: Everseasonal

dependencies:
  - memo:submenus-dll
  - doesnt:exist

---
assetId: smf-16-everseasonal
version: "1.0.2"
lastModified: "2024-12-21T:21:40:00Z"
url: https://community.simtropolis.com/files/file/123-file/?do=download&r=456
`);

let result = {
  timestamp: '2024-12-21T20:26:27',
  packages: [
    {
      id: 'smf-16:everseasonal',
      files: [
        'src/yaml/smf-16/everseasonal.yaml',
      ],
    },
  ],
};
core.setOutput('result', JSON.stringify(result));
