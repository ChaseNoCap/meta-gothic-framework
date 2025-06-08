// Dynamic import for ES module
let fetch;
(async () => {
  const module = await import('node-fetch');
  fetch = module.default;
})();

const GITHUB_API_BASE = 'https://api.github.com';

async function githubFetch(path, token) {
  // Wait for fetch to be loaded if not yet available
  if (!fetch) {
    const module = await import('node-fetch');
    fetch = module.default;
  }
  
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

module.exports = {
  Query: {
    async githubUser(_, __, { githubToken }) {
      const data = await githubFetch('/user', githubToken);
      return {
        id: data.id.toString(),
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        htmlUrl: data.html_url
      };
    },
    
    async githubRepository(_, { owner, name }, { githubToken }) {
      const data = await githubFetch(`/repos/${owner}/${name}`, githubToken);
      return {
        id: data.id.toString(),
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        private: data.private,
        fork: data.fork,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        pushedAt: data.pushed_at,
        homepage: data.homepage,
        language: data.language,
        forksCount: data.forks_count,
        stargazersCount: data.stargazers_count,
        watchersCount: data.watchers_count,
        defaultBranch: data.default_branch,
        owner: {
          id: data.owner.id.toString(),
          login: data.owner.login,
          avatarUrl: data.owner.avatar_url,
          htmlUrl: data.owner.html_url
        },
        htmlUrl: data.html_url,
        cloneUrl: data.clone_url,
        gitUrl: data.git_url,
        sshUrl: data.ssh_url
      };
    },
    
    async githubRepositories(_, { first = 30 }, { githubToken }) {
      const data = await githubFetch(`/user/repos?per_page=${first}&sort=updated`, githubToken);
      return data.map(repo => ({
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        fork: repo.fork,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        homepage: repo.homepage,
        language: repo.language,
        forksCount: repo.forks_count,
        stargazersCount: repo.stargazers_count,
        watchersCount: repo.watchers_count,
        defaultBranch: repo.default_branch,
        owner: {
          id: repo.owner.id.toString(),
          login: repo.owner.login,
          avatarUrl: repo.owner.avatar_url,
          htmlUrl: repo.owner.html_url
        },
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        gitUrl: repo.git_url,
        sshUrl: repo.ssh_url
      }));
    }
  },
  
  GitHubUser: {
    __resolveReference({ id }, { githubToken }) {
      return githubFetch(`/user/${id}`, githubToken).then(data => ({
        id: data.id.toString(),
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        htmlUrl: data.html_url
      }));
    }
  },
  
  GitHubRepository: {
    __resolveReference({ id }, { githubToken }) {
      return githubFetch(`/repositories/${id}`, githubToken).then(data => ({
        id: data.id.toString(),
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        private: data.private,
        fork: data.fork,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        pushedAt: data.pushed_at,
        homepage: data.homepage,
        language: data.language,
        forksCount: data.forks_count,
        stargazersCount: data.stargazers_count,
        watchersCount: data.watchers_count,
        defaultBranch: data.default_branch,
        owner: {
          id: data.owner.id.toString(),
          login: data.owner.login,
          avatarUrl: data.owner.avatar_url,
          htmlUrl: data.owner.html_url
        },
        htmlUrl: data.html_url,
        cloneUrl: data.clone_url,
        gitUrl: data.git_url,
        sshUrl: data.ssh_url
      }));
    }
  }
};