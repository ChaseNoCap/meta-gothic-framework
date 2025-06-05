/**
 * Links local repository to GitHub repository data
 */
export default function linkGitHubData(root, args, context, info) {
  // root is the local repository
  const localRepo = root;
  
  // Extract owner and name from path (e.g., "ChaseNoCap/meta-gothic-framework")
  const parts = localRepo.path.split('/');
  if (parts.length < 2) return null;
  
  const [owner, ...nameParts] = parts;
  const name = nameParts.join('/');
  
  // Query GitHub repository
  return context.GitHub.Query.repos_get({
    owner,
    repo: name
  });
}