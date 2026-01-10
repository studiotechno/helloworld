// GitHub API types

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  language: string | null
  default_branch: string
  updated_at: string
  pushed_at: string
  size: number
  stargazers_count: number
}

export interface GitHubContent {
  name: string
  path: string
  sha: string
  size: number
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  content?: string
  encoding?: string
  download_url?: string
}

export interface GitHubCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
}

export interface GitHubRateLimit {
  limit: number
  remaining: number
  reset: number
  used: number
}
