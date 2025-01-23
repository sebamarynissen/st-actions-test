// # fetch.js
import fs from 'node:fs';
import path from 'node:path';
import core from '@actions/core';

const cwd = process.env.GITHUB_WORKSPACE ?? process.cwd();

async function make(file, contents) {
  let fullPath = path.join(cwd, `src/yaml/${file}`);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, contents);
}

await make('smf-16/everseasonal.yaml', `
group: smf-16
name: everseasonal
version: "1.0.3"
subfolder: 150-mods
info:
  summary: Everseasonal
  description: |-
    Hello world, how are you?
  author: Hello

dependencies:
  - memo:submenus-dll

assets:
  - assetId: smf-16-everseasonal

---
assetId: smf-16-everseasonal
version: "1.0.3"
lastModified: "2024-12-21T:21:40:00Z"
url: https://community.simtropolis.com/files/file/123-file/?do=download&r=456
`);

await make('jasoncw/collection.yaml', `
group: jasoncw
name: collection
version: "1.0.0"
subfolder: 200-residential
info:
  summary: Jasoncw Collection
dependencies:
  - memo:submenu-dll
variants:
  - variant: { jasoncw:collection:mode: "on" }
  - variant: { jasoncw:collection:mode: "off" }
`);

let result = {
  // timestamp: new Date().toISOString(),
  packages: [
    // {
    //   id: 'aaron-graham:gracie-manor',
    //   branchId: '423',
    //   fileId: '423',
    //   additions: [
    //     'src/yaml/aaron-graham/gracie-manor.yaml',
    //   ],
    //   githubUsername: 'sebamarynissen',
    // },
    {
      id: 'smf-16:everseasonal',
      additions: [
        'src/yaml/smf-16/everseasonal.yaml',
      ],
      githubUsername: 'sebamarynissen',
      message: {
        to: 'smf_16',
      },
    },
    {
      id: 'jasoncw:collection',
      additions: [
        'src/yaml/jasoncw/collection.yaml',
      ],
    },
  ],
};
let hasNewContent = result.packages.length > 0;
core.setOutput('packages', JSON.stringify(result.packages));
core.setOutput('timestamp', JSON.stringify(result.timestamp));
core.setOutput('has-new-content', hasNewContent);

if (!hasNewContent) {
  core.notice('No new content was found.');
}
