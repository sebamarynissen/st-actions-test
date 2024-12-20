// # create-prs.js
import fs from 'node:fs';
import path from 'node:path';
import simpleGit from 'simple-git';
import { Octokit } from '@octokit/rest';
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const baseDir = process.cwd();
const git = simpleGit({ baseDir });
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

// # handleResult(result)
// Handles the result of a single package being added to the channel.
async function handleResult(result) {

	console.log(`Creating new branch ${result.branch}`);
	await git.checkoutLocalBranch(result.branch);

	// Re-apply the changes from this package.
	for (let file of result.files) {
		let dirname = path.dirname(file.path);
		await fs.promises.mkdir(dirname, { recursive: true });
		await fs.promises.writeFile(file.path, file.contents);
	}

	// Add all the modified files & then commit.
	console.log('Committing files');
	for (let file of result.files) {
		await git.add(file.name);
	}
	await git.commit(result.title, { '--allow-empty': true });
	console.log(`Pushing ${result.branch} to origin`);
	await git.push('origin', result.branch);

	// If no PR existed yet, then we have to push the branch. Otherwise it will 
	// be handled for us.
	console.log('Creating new PR on GitHub');
	let { data: pr } = await octokit.pulls.create({
		owner,
		repo,
		base: 'main',
		title: result.title,
		head: result.branch,
		body: result.body,
	});

	console.log('Adding labels');
	octokit.issues.addLabels({
		owner,
		repo,
		issue_number: pr.number,
		labels: ['package'],
	});

	// Trigger the lint action on the PR with a repository dispatch. We can't 
	// rely on the normal actions workflow because GitHub does not trigger 
	// actions on commits made by a bot to avoid infinite loops apparently.
	await octokit.repos.createDispatchEvent({
		owner,
		repo,
		event_type: 'lint',
		client_payload: {
			ref: `refs/pull/${pr.number}/merge`,
			sha: pr.head.sha,
			pr: pr.number,
		},
	});

	// Cool, now delete the branch again.
	await git.checkout('main');
	await git.deleteLocalBranch(result.branch, true);
	console.log(`Handled ${result.title}`);

}

// # create(results)
// Creates or updates PRs for all the packages that have been created.
export default async function create(results) {

	// At this point, we assume that the repository is on the main branch, but 
	// not in a clean state, meaning the added files are in the src/yaml file. 
	// However, we will need to fetch the branch of existing repos one by one, 
	// so we will read in all files in memory and then reapply them manually 
	// later on. Might be a way to do this natively with Git, but it has proven 
	// to be extremely hard, lol.
	await git.add('.');
	for (let result of results) {
		let files = [];
		for (let name of result.files) {
			let fullPath = path.join(process.env.GITHUB_WORKSPACE, name);
			let contents = await fs.promises.readFile(fullPath);
			files.push({
				name,
				path: fullPath,
				contents,
			});
		}
		result.files = files;
	}

	// Reset the repository to a clean state again.
	await git.reset({ '--hard': true });

	// Fetch all open PRs from GitHub so that can figure out which files are 
	// updates of existing, open PR's.
	console.log('Fetching open pull requests from GitHub');
	const { data: prs } = await octokit.pulls.list({
		owner,
		repo,
		state: 'open',
	});

	// Create PR's and update branches for every result.
	for (let result of results) {
		await handleResult({
			pr: prs.find(pr => pr.head.ref === result.branch),
			...result,
		});
	}

}

const randomHex = Math.random().toString(16).slice(2);

await create([{
	branch: `package/${randomHex}`,
	title: 'Some PR',
	files: [],
}]);
