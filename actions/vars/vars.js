// # vars.js
import github from '@actions/github';

const context = github.context;
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

const response = await octokit.request('GET /repos/{owner}/{repo}/actions/variables/{name}', {
	...context.repo,
	name: 'LAST_RUN',
});
console.log(response);
