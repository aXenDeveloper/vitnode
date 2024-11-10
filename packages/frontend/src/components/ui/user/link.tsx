import React from 'react';
import { User } from 'vitnode-shared/user.dto';

import { Link } from '../../../navigation';

interface Props
  extends Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'href'
  > {
  user: Pick<User, 'name' | 'name_seo'>;
}

export const UserLink = ({ user: { name, name_seo }, ...props }: Props) => {
  return (
    <Link className="font-medium" href={`/profile/${name_seo}`} {...props}>
      {name}
    </Link>
  );
};
