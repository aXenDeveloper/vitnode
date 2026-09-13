export const userCoverStyle = (avatarColor: string): React.CSSProperties => {
  const color = `#${avatarColor}`;

  return {
    backgroundImage: `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 55%, transparent) 60%, color-mix(in oklab, ${color} 20%, transparent) 100%)`,
  };
};
