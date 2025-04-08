import { getUserById } from './user/get-user-by-id';
import { signInWithPassword } from './user/sign-in-with-passwords';
import { signUp } from './user/sign-up';

export class UserModel {
  getUserById = getUserById;
  signInWithPassword = signInWithPassword;
  signUp = signUp;
}
