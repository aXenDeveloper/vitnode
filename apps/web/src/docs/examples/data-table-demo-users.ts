export interface DemoUser {
  email: string
  id: number
  name: string
  role: 'Admin' | 'Editor' | 'Viewer'
  status: 'Active' | 'Banned' | 'Invited'
}

const firstNames = [
  'Ada',
  'Alan',
  'Grace',
  'Linus',
  'Margaret',
  'Dennis',
  'Katherine',
  'Ken',
  'Barbara',
  'Guido',
  'Hedy',
  'Tim',
]
const lastNames = [
  'Lovelace',
  'Turing',
  'Hopper',
  'Torvalds',
  'Hamilton',
  'Ritchie',
  'Johnson',
  'Thompson',
  'Liskov',
  'van Rossum',
  'Lamarr',
  'Berners-Lee',
]
const roles = ['Admin', 'Editor', 'Viewer', 'Viewer'] as const
const statuses = ['Active', 'Active', 'Invited', 'Banned'] as const

export const demoUsers: DemoUser[] = Array.from({ length: 36 }, (_, index) => {
  const first = firstNames[index % firstNames.length] ?? 'Ada'
  const last =
    lastNames[
      (index * 5 + Math.floor(index / firstNames.length)) % lastNames.length
    ] ?? 'Lovelace'

  return {
    email:
      `${first}.${last}`.toLowerCase().replaceAll(' ', '') + '@vitnode.com',
    id: index + 1,
    name: `${first} ${last}`,
    role: roles[index % roles.length] ?? 'Viewer',
    status: statuses[(index * 3) % statuses.length] ?? 'Active',
  }
})
