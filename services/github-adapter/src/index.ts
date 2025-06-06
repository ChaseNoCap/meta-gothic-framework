import { createYoga } from 'graphql-yoga';
import { createServer } from 'http';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read schema
const typeDefs = parse(readFileSync(join(__dirname, '..', 'schema.graphql'), 'utf-8'));

const GITHUB_API_BASE = 'https://api.github.com';

async function githubFetch(path: string, token: string) {
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

const resolvers = {
  Query: {
    async githubUser(_: any, __: any, context: any) {
      const data = await githubFetch('/user', context.githubToken);
      return {
        id: data.id.toString(),
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        htmlUrl: data.html_url
      };
    },
    
    async githubRepository(_: any, { owner, name }: any, context: any) {
      const data = await githubFetch(`/repos/${owner}/${name}`, context.githubToken);
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
    
    async githubRepositories(_: any, { first = 30 }: any, context: any) {
      const data = await githubFetch(`/user/repos?per_page=${first}&sort=updated`, context.githubToken);
      return data.map((repo: any) => ({
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
    __resolveReference({ id }: any, context: any) {
      return githubFetch(`/user/${id}`, context.githubToken).then(data => ({
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
    __resolveReference({ id }: any, context: any) {
      return githubFetch(`/repositories/${id}`, context.githubToken).then(data => ({
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

const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);

const yoga = createYoga({
  schema,
  context: () => ({
    githubToken: process.env.GITHUB_TOKEN
  }),
  graphqlEndpoint: '/graphql',
  landingPage: true
});

const server = createServer(yoga);
const port = process.env.PORT || 3005;

server.listen(port, () => {
  console.log(`🚀 GitHub service ready at http://localhost:${port}/graphql`);
});