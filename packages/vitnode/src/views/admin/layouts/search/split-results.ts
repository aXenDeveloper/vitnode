export const splitResultBudget = ({
  budget,
  navCount,
  usersCount,
}: {
  budget: number;
  navCount: number;
  usersCount: number;
}): { nav: number; users: number } => {
  const fairShare = Math.floor(budget / 2);
  const nav = Math.min(navCount, budget - Math.min(usersCount, fairShare));

  return { nav, users: Math.min(usersCount, budget - nav) };
};
