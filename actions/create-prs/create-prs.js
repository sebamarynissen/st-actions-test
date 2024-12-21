// # create-prs.js
import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import core from '@actions/core';
import github from '@actions/github';
import { simpleGit } from 'simple-git';

// Setup our git client & octokit.
const cwd = process.env.GITHUB_WORKSPACE ?? process.env.cwd();
const git = simpleGit(simpleGit);
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
const { context } = github;
console.log(context.repo);

// First of all we will create a new file called `LAST_RUN` where we'll commit 
// the timestamp of the last run.
// const result = JSON.parse(core.getInput('fetch-result'));
await fs.promises.writeFile(path.join(cwd, 'LAST_RUN'), result.timestamp);
await git.add('LAST_RUN');
const message = result.timestamp.slice(0, 19) + 'Z';
await git.commit(message);
await git.push('origin', 'main');

// Before we can generate our PRs, we need to make sure the repository is in a 
// clean state. That's because if we checkout an existing branch, it might 
// overwrite the changes made by the fetch action, so we first have to figure 
// out all files that have changed and undo those changes.
for (let pkg of result.packages) {
	let files = [];
	for (let name of pkg.files) {
		let fullPath = path.join(cwd, name);
		let contents = await fs.promises.readFile(fullPath);
		files.push({
			name,
			path: fullPath,
			contents,
		});
	}
	pkg.files = files;
}

// Reset the repository to a clean state again.
await git.reset({ '--hard': true });

// Fetch all open PRs from GitHub so that we can figure out which files are 
// updates of existing, open PRs.
let spinner = ora('Fetching open pull requests from GitHub').start();
const { data: prs } = await octokit.rest.pulls.list({
	...context.repo,
	state: 'open',
});
spinner.succeed();

// Create the PRs and update the branches for each result.
for (let pkg of result.packages) {
	let pr = await createPr(pkg, prs);
}

// # createPr(pkg)
// Creates a new PR for the given package, or updates it if it already exists.
async function createPr(pkg, prs) {
	let branch = `package/${pkg.id.replace(':', '/')}`;
	let pr = prs.find(pr => pr.head.ref === branch);

	// If a PR already exists for this branch, it's probably a fix dpeloyed by 
	// the creator of the package. This means we have to fetch the branch from 
	// the server.
	if (pr) {
		let spinner = ora(`Checking out origin/${branch}`);
		await git.fetch();
		await git.checkoutBranch(branch, `origin/${branch}`);
		spinner.succeed();
	} else {
		let spinner = ora(`Creating new branch ${branch}`);
		await git.checkoutLocalBranch(branch);
		spinner.succeed();
	}

	// Re-apply the changes from this package.
	for (let file of pkg.files) {
		let dirname = path.dirname(file.path);
		await fs.promises.mkdir(dirname, { recursive: true });
		await fs.promises.writeFile(file.path, file.contents);
	}

	// Add all the modified files & then commit.
	let spinner = ora('Committing files').start();
	for (let file of pkg.files) {
		await git.add(file.name);
	}
	await git.commit(pkg.title, { '--allow-empty': true });
	let sha = await git.revparse(['HEAD']);
	spinner.succeed();
	spinner = ora(`Pushing ${branch} to origin`).start();
	await git.push('origin', branch);
	spinner.succeed();

	// If no PR existed yet, then we have to push the branch. Otherwise it will 
	// be handled for us.
	if (!pr) {
		let spinner = ora('Creating new PR on GitHub').start();
		({ data: pr } = await octokit.rest.pulls.create({
			...context.repo,
			base: 'main',
			title: pkg.title,
			head: branch,
			body: pkg.body,
		}));
		spinner.succeed();

		spinner = ora('Adding labels').start();
		octokit.rest.issues.addLabels({
			...context.repo,
			issue_number: pr.number,
			labels: ['package'],
		});
		spinner.succeed();
	}

	// Cool, now delete the branch again.
	await git.checkout('main');
	await git.deleteLocalBranch(branch, true);
	ora(`Handled ${pkg.title}`).succeed();

	// Return the pr info so that our action can set it as output.
	return {
		branch,
		ref: `refs/pull/${pr.number}/merge`,
		number: pr.number,
		sha,
	};

}
