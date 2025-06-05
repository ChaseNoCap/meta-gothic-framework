/**
 * Links GitHub repository to local repository data
 */
export default function linkLocalRepository(root, args, context, info) {
  // root is the GitHub repository
  const githubRepo = root;
  
  // Query local repository by path
  const repoPath = `${githubRepo.owner.login}/${githubRepo.name}`;
  
  return context.RepoAgent.Query.repositoryDetails({
    path: repoPath
  });
}